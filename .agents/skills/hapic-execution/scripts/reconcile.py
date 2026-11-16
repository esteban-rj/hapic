#!/usr/bin/env python3
"""Plan first; recreate through the owning control plane, remove only explicitly owned leftovers."""
import argparse
import json
import os
from pathlib import Path
import sys
import time


def plan_actions(agents, containers, installation, retired, impact, fingerprints, image_id=None, requested=()):
    agents = {agent['id']: agent for agent in agents}
    unknown = set(requested) - set(agents)
    if unknown:
        raise ValueError('Agente solicitado fuera de la instalación.')
    if impact == 'ui':
        if requested or retired:
            raise ValueError('El modo UI no permite conciliar runtimes ni retirar instalaciones.')
        return []
    actions = []
    found = set()
    for container in containers:
        labels = container.get('labels') or {}
        owner, agent_id = labels.get('hapic.installation'), labels.get('hapic.agent')
        if not owner or not agent_id:
            continue
        if owner in retired:
            actions.append({'action': 'remove', 'container': container['id'], 'agent_id': agent_id, 'installation': owner, 'reason': 'retired-installation'})
            continue
        if owner != installation:
            continue
        agent = agents.get(agent_id)
        if not agent or agent.get('container_id') != container['id']:
            actions.append({'action': 'remove', 'container': container['id'], 'agent_id': agent_id, 'installation': owner, 'reason': 'superseded-or-orphaned'})
            continue
        found.add(agent_id)
        selected = agent_id in requested
        outdated = labels.get('hapic.runtime') != fingerprints.get(agent_id) or bool(image_id and container.get('image_id') != image_id)
        if selected or (impact == 'runtime' and container['status'] == 'running' and outdated):
            actions.append({'action': 'recreate', 'agent_id': agent_id, 'reason': 'requested' if selected else 'outdated-runtime'})
    for agent in agents.values():
        if agent['id'] not in found and (agent['id'] in requested or (impact == 'runtime' and agent.get('container_id') and agent['status'] == 'running')):
            actions.append({'action': 'recreate', 'agent_id': agent['id'], 'reason': 'missing-runtime'})
    return actions


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--impact', required=True, choices=['ui', 'backend', 'runtime'])
    parser.add_argument('--retire-installation', action='append', default=[])
    parser.add_argument('--agent-id', action='append', default=[])
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(argv)
    if args.impact == 'ui':
        actions = plan_actions([], [], '', set(args.retire_installation), 'ui', {}, requested=args.agent_id)
        print(json.dumps({'mode': 'ui', 'actions': actions, 'docker_unchanged': True}))
        return
    sys.path.insert(0, str(args.repo.resolve()))
    from backend.runtime import DockerRuntime
    from backend.storage import Store
    import docker
    import httpx

    data_dir = (args.data_dir or Path(os.getenv('HAPIC_DATA_DIR', str(args.repo / '.hapic')))).resolve()
    if not (data_dir / 'platform.db').is_file() or not (data_dir / 'secrets/master.key').is_file():
        raise ValueError('Directorio de datos inexistente o incompleto; no se creará otra instalación.')
    retired = {str(Path(value).resolve()) for value in args.retire_installation}
    if str(data_dir) in retired:
        raise ValueError('No se puede retirar la instalación elegida para ejecutar Hapic.')
    store, runtime = Store(data_dir), DockerRuntime()
    client = runtime.client()
    agents = store.all('SELECT * FROM agents')
    containers = client.containers.list(all=True, filters={'label': 'hapic.agent'})
    inventory = [{'id': item.id, 'status': item.status, 'labels': item.labels, 'image_id': item.image.id} for item in containers]
    fingerprints = {agent['id']: runtime.fingerprint(agent, store) for agent in agents} if args.impact == 'runtime' else {}
    try:
        desired_image = client.images.get(runtime.image).id
    except docker.errors.ImageNotFound:
        desired_image = None
    actions = plan_actions(agents, inventory, str(data_dir), retired, args.impact, fingerprints, desired_image, args.agent_id)
    print(json.dumps({'mode': 'apply' if args.apply else 'plan', 'url': 'http://127.0.0.1:8000', 'installation': str(data_dir), 'actions': actions}, ensure_ascii=False), flush=True)
    if not args.apply or not actions:
        return
    with httpx.Client(base_url='http://127.0.0.1:8000', timeout=20, trust_env=False) as api:
        bootstrap = api.get('/api/bootstrap')
        bootstrap.raise_for_status()
        api.headers['X-Hapic-CSRF'] = bootstrap.json()['csrf']
        state = api.get('/api/state')
        state.raise_for_status()
        if {a['id'] for a in state.json()['agents']} != {a['id'] for a in agents}:
            raise ValueError('La API de 8000 pertenece a otros datos o cambió el equipo. Actualiza el plan.')
        if any(action['action'] == 'recreate' for action in actions):
            caps = api.get('/api/capabilities')
            caps.raise_for_status()
            if not caps.json()['openai']['configured'] or not caps.json()['docker']['available']:
                raise ValueError('Falta Docker o la credencial; no se retirará ningún contenedor.')
        # Restore the active installation before retiring old executions.
        for action in [a for a in actions if a['action'] == 'recreate']:
            agent_id = action['agent_id']
            previous = next(a for a in agents if a['id'] == agent_id).get('container_id')
            response = api.post(f'/api/agents/{agent_id}/start')
            response.raise_for_status()
            deadline = time.monotonic() + 300
            while time.monotonic() < deadline:
                state_response = api.get('/api/state')
                state_response.raise_for_status()
                agent = next(a for a in state_response.json()['agents'] if a['id'] == agent_id)
                if agent['status'] in {'blocked', 'error'}:
                    raise RuntimeError(f'Falló la provisión de {agent_id}; consulta su etapa en Hapic.')
                if agent['status'] == 'running' and agent.get('container_id') != previous:
                    readiness = api.get(f'/api/agents/{agent_id}/runtime')
                    readiness.raise_for_status()
                    if readiness.json().get('ready'):
                        break
                time.sleep(1)
            else:
                raise RuntimeError(f'Tiempo agotado para {agent_id}; revisa su estado antes de reintentar.')
            print(json.dumps({'agent_id': agent_id, 'result': 'ready'}), flush=True)
        for action in [a for a in actions if a['action'] == 'remove']:
            try:
                item = client.containers.get(action['container'])
            except docker.errors.NotFound:
                continue
            # Recheck ownership and the current DB reference after provisioning.
            if item.labels.get('hapic.installation') != action['installation'] or item.labels.get('hapic.agent') != action['agent_id']:
                raise RuntimeError('La propiedad del contenedor cambió; limpieza detenida.')
            if action['installation'] == str(data_dir):
                agent = store.one('SELECT container_id FROM agents WHERE id=?', (action['agent_id'],))
                if agent and agent['container_id'] == item.id:
                    raise RuntimeError('El contenedor volvió a estar vigente; actualiza el plan.')
            if item.status == 'running':
                item.stop(timeout=20)
            item.remove(v=False)
            print(json.dumps({'container': action['container'], 'result': 'removed', 'data_preserved': True}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Provider/Docker/HTTP exceptions may include sensitive data.
        if isinstance(error, (ValueError, RuntimeError)):
            print(str(error), file=sys.stderr)
        else:
            print('No se pudo conciliar Hapic. Revisa la conexión y el estado; no se reintentará automáticamente.', file=sys.stderr)
        sys.exit(1)
