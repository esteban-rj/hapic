"""Lifecycle decisions protect unrelated containers, pending profiles and UI-only execution."""
import importlib.util
import os
from pathlib import Path
import subprocess

import pytest

from backend.runtime import DockerRuntime
from backend.service import Service
from backend.storage import Store


SCRIPT = Path(__file__).resolve().parents[1] / '.agents/skills/hapic-execution/scripts/reconcile.py'
spec = importlib.util.spec_from_file_location('hapic_reconcile', SCRIPT)
reconcile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reconcile)


def container(agent_id='a', installation='/data/current', signature='current', container_id='c', status='running'):
    return {'id': container_id, 'status': status, 'labels': {'hapic.agent': agent_id, 'hapic.installation': installation, 'hapic.runtime': signature}, 'image_id': 'image-1'}


def plan(agents=None, containers=None, impact='runtime', retired=(), requested=()):
    return reconcile.plan_actions(
        agents if agents is not None else [{'id': 'a', 'container_id': 'c', 'status': 'running'}],
        containers if containers is not None else [container()],
        '/data/current', set(retired), impact, {'a': 'current'}, 'image-1', requested,
    )


def test_ui_mode_does_not_access_docker_or_create_an_installation(tmp_path):
    result = subprocess.run([os.sys.executable, str(SCRIPT), '--impact', 'ui', '--repo', str(tmp_path)], capture_output=True, text=True)
    assert result.returncode == 0 and '"docker_unchanged": true' in result.stdout
    assert not (tmp_path / '.hapic').exists()
    assert plan(impact='ui', containers=[container(signature='outdated')]) == []
    with pytest.raises(ValueError):
        plan(impact='ui', retired=['/data/retired'])


def test_outdated_runtime_is_selected_without_touching_other_installations():
    assert plan() == []
    actions = plan(containers=[container(signature='old'), container('other', '/data/unrelated', 'old', 'foreign')])
    assert len(actions) == 1 and actions[0]['action'] == 'recreate' and actions[0]['agent_id'] == 'a'
    assert plan(containers=[container(signature='old')], impact='backend') == []


def test_actual_image_change_requires_recreation():
    item = container()
    item['image_id'] = 'older-image'
    assert plan(containers=[item])[0]['action'] == 'recreate'


def test_superseded_containers_are_removed_but_current_agent_is_kept():
    actions = plan(containers=[container(), container(container_id='superseded')], impact='backend')
    assert len(actions) == 1 and actions[0]['container'] == 'superseded'
    assert actions[0]['action'] == 'remove'


def test_retired_installations_require_exact_labels_and_explicit_selection():
    retired = container('old', '/data/retired', 'old', 'retired')
    unlabeled = {'id': 'foreign', 'labels': {}, 'status': 'running'}
    assert plan(containers=[retired, unlabeled])[-1]['action'] == 'recreate'  # restore missing active agent only
    actions = plan(containers=[container(), retired, unlabeled], retired=['/data/retired'])
    assert len(actions) == 1 and actions[0]['container'] == 'retired'


def test_missing_active_runtime_restores_without_starting_every_pending_template():
    agents = [{'id': 'a', 'container_id': 'gone', 'status': 'running'}, {'id': 'new', 'container_id': None, 'status': 'pending'}]
    actions = plan(agents=agents, containers=[])
    assert [item['agent_id'] for item in actions] == ['a']
    assert [item['agent_id'] for item in plan(agents=agents, containers=[], impact='backend', requested=['new'])] == ['new']
    with pytest.raises(ValueError):
        plan(requested=['not-in-this-installation'])


def test_runtime_signature_tracks_mcp_credentials_and_spec_without_exposing_them(tmp_path, monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    store = Store(tmp_path)
    service = Service(store)
    org = service.create_org('Studio')
    project = service.create_project(org['id'], 'Launch')
    agent = store.one('SELECT * FROM agents WHERE project_id=?', (project['id'],))
    runtime = DockerRuntime()
    initial = runtime.fingerprint(agent, store)
    store.secret('openai', 'sk-test-private-value')
    rotated = runtime.fingerprint(agent, store)
    assert rotated != initial and 'sk-test-private-value' not in rotated
    monkeypatch.setenv('HAPIC_MCP_URL', 'http://hapic:8000/mcp/')
    assert runtime.fingerprint(agent, store) != rotated
    previous = runtime.fingerprint(agent, store)
    runtime.spec_version += 1
    assert runtime.fingerprint(agent, store) != previous


def test_native_launcher_refuses_other_ports_before_starting_process(tmp_path):
    script = Path(__file__).resolve().parents[1] / 'scripts/start.sh'
    result = subprocess.run(['/bin/sh', str(script), '8002'], env={**os.environ, 'HAPIC_APP_DIR': str(tmp_path)}, capture_output=True, text=True)
    assert result.returncode != 0 and '8000' in result.stderr
