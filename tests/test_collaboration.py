"""Direct collaboration contracts; no Docker or provider calls."""
import json
import shutil
from unittest.mock import patch

import pytest

from backend.service import Service
from backend.storage import Store
from backend.runtime import platform_instructions
from backend import templates
from backend.templates import SPECIALISTS, agent_profile, tools_for
from test_platform import TestRuntime


@pytest.fixture
def team(tmp_path):
    service = Service(Store(tmp_path), TestRuntime())
    org = service.create_org('Studio')
    project = service.create_project(org['id'], 'Product')
    a = service.create_agent(project['id'], 'UX', 'ux')
    b = service.create_agent(project['id'], 'Design', 'graphic-designer')
    return service, a, b


def test_live_roster_and_permissions(team):
    service, a, b = team
    text = platform_instructions(a, service.store)
    assert b['id'] in text and 'delegate_task' in text
    roster = service.tool(a, 'list_project_agents', {})['agents']
    assert next(row for row in roster if row['id'] == b['id'])['capabilities']
    later = service.create_agent(a['project_id'], 'Planner', 'architect')
    assert later['id'] in platform_instructions(a, service.store)
    assert 'create_specialist_agent' not in tools_for(a['kind'])


def test_delegation_scope_idempotency_and_cycles(team):
    service, a, b = team
    args = dict(agent_id=b['id'], task='Review', request_id='stable', context='Flow', expected_result='Findings')
    with patch('backend.service.threading.Thread'):
        task = service.tool(a, 'delegate_task', args)
        assert service.tool(a, 'delegate_task', args)['id'] == task['id']
        with pytest.raises(ValueError):
            service.tool(a, 'delegate_task', {**args, 'task': 'Different'})
        with pytest.raises(ValueError, match='ciclo'):
            service.tool(b, 'delegate_task', dict(agent_id=a['id'], task='Loop', request_id='loop'))
    with pytest.raises(PermissionError):
        service.tool(a, 'delegate_task', {**args, 'agent_id': a['id']})
    org = service.create_org('Other')
    other = service.create_project(org['id'], 'Other')
    outsider = service.create_agent(other['id'], 'Other UX', 'ux')
    with pytest.raises(PermissionError):
        service.tool(a, 'delegate_task', {**args, 'agent_id': outsider['id']})
    with pytest.raises(LookupError):
        service.tool(outsider, 'get_task_status', {'task_id': task['id']})


@pytest.mark.parametrize('language,reply_instruction,preamble', [
    ('es', 'Responde en español durante este turno', 'Tarea delegada por un colega del proyecto'),
    ('en', 'Reply in English for this turn', 'Task delegated by a project colleague'),
])
def test_direct_execution_and_persistent_result(team, monkeypatch, language, reply_instruction, preamble):
    service, a, b = team
    monkeypatch.setenv('OPENAI_API_KEY', 'test-only')
    service.store.execute("UPDATE agents SET container_id='test' WHERE id=?", (b['id'],))
    calls = []
    deliverable = 'Usar una sola acción principal y conservar el texto de navegación.'
    answer = (
        '**Estado del trabajo:** completado\n**Resultado:** ' + deliverable
        + f"\n**Artefactos:** agent_id={b['id']}, entrega-visual.md"
        + '\n**Validación:** texto guardado; sin generación de imágenes solicitada.'
        + '\n**Pendientes para el remitente:** ninguno.'
    )
    async def chat(agent, store, text, request_id):
        calls.append(agent['id'])
        request = json.loads(text.split('\n', 1)[1])
        assert request == {'id': request_id, 'sender_id': a['id'], 'task': 'Review',
                           'context': 'Un flujo de navegación con dos acciones principales.',
                           'expected_result': 'Recomendación visual utilizable en texto.'}
        assert text.startswith(preamble)
        instructions = platform_instructions(agent, store)
        assert reply_instruction in instructions
        assert agent_profile('graphic-designer', language)['delegation_contract']['owns'][0] in instructions
        assert store.setting('agent-language-' + agent['id']) == language
        service.tool(agent, 'project_write_file', {'path': 'entrega-visual.md', 'content': deliverable})
        return answer, 'completed'
    service.runtime.chat = chat
    service.runtime.inspect = lambda *_: {'status': 'running', 'ready': True}
    service.store.set_setting('agent-language-' + a['id'], language)
    with patch('backend.service.threading.Thread') as thread:
        task = service.tool(a, 'delegate_task', dict(
            agent_id=b['id'], task='Review', request_id='one',
            context='Un flujo de navegación con dos acciones principales.',
            expected_result='Recomendación visual utilizable en texto.'))
    service.store.set_setting('agent-language-' + a['id'], 'es')
    scheduled = thread.call_args.kwargs
    scheduled['target'](*scheduled['args'])
    result = service.tool(a, 'get_task_status', {'task_id': task['id']})
    assert result['status'] == 'completed' and result['result'] == answer
    assert deliverable in result['result']
    with pytest.raises(ValueError):
        service.tool(a, 'project_read_file', {'path': 'entrega-visual.md'})
    assert calls == [b['id']]
    restarted = Service(Store(service.store.root), TestRuntime())
    assert restarted.tool(a, 'get_task_status', {'task_id': task['id']})['result'] == answer


def test_automatic_model_uses_delegated_context(team, monkeypatch):
    service, sender, recipient = team
    monkeypatch.setenv('OPENAI_API_KEY', 'test-only')
    service.store.execute("UPDATE agents SET model='auto',container_id='test' WHERE id=?", (recipient['id'],))

    async def chat(agent, store, text, request_id):
        assert agent['model'] == 'gpt-6-astra' and agent['effort'] == 'xhigh'
        return 'Review completed', 'completed'

    service.runtime.chat = chat
    service.runtime.inspect = lambda *_: {'status': 'running', 'ready': True}
    with patch('backend.service.threading.Thread'):
        task = service.tool(sender, 'delegate_task', dict(agent_id=recipient['id'], task='Review',
                            request_id='automatic', context='Find the root cause of a regression.'))
    service.run_delegated_task(task['id'], 'en')
    assert service.tool(sender, 'get_task_status', {'task_id': task['id']})['status'] == 'completed'
    assert service.agent(recipient['id'])['model'] == 'auto'


def test_all_profiles_expose_contracts_and_instructions_in_roster_and_catalog(team):
    service, a, b = team
    architect = service.create_agent(a['project_id'], 'Planner', 'architect')
    service.create_agent(a['project_id'], 'Coder', 'coder', architect['id'])
    service.create_agent(a['project_id'], 'Community', 'community-manager')
    roster = service.tool(a, 'list_project_agents', {})['agents']
    assert {entry['kind'] for entry in roster} == {*SPECIALISTS, 'hapic'}
    fields = {'owns', 'delegate_when', 'required_inputs', 'returns', 'limitations'}
    catalog = service.tool(next(entry for entry in roster if entry['kind'] == 'hapic'), 'list_agent_templates', {})['templates']
    for entry in roster:
        contract = entry['delegation_contract']
        assert contract.keys() == fields
        assert all(isinstance(values, list) and values and all(isinstance(value, str) and value.strip() for value in values)
                   for values in contract.values())
        agent = service.agent(entry['id'])
        home = service.store.agent_path(agent) / 'hermes'
        english_contract = agent_profile(entry['kind'], 'en')['delegation_contract']
        assert english_contract != contract
        assert json.dumps(english_contract, ensure_ascii=False) in (home / 'SOUL.md').read_text(encoding='utf-8')
        instructions = platform_instructions(agent, service.store)
        assert json.dumps(contract, ensure_ascii=False) in instructions
        assert 'Estado del trabajo' in instructions and 'Pendientes para el remitente' in instructions
        assert not {'instructions', 'tools', 'memories', 'container_id'} & entry.keys()
        if entry['kind'] in SPECIALISTS:
            assert next(item for item in catalog if item['kind'] == entry['kind'])['delegation_contract'] == contract
    coder = next(entry for entry in roster if entry['kind'] == 'coder')
    assert coder['planner_id'] == architect['id']
    assert 'delegate_task' in platform_instructions(service.agent(coder['id']), service.store)


def test_existing_profiles_use_current_contract_and_rules_without_rewriting_memory(team, tmp_path, monkeypatch):
    service, a, b = team
    home = service.store.agent_path(a) / 'hermes'
    # Emulate an older persistent profile. Current instructions must arrive through the turn.
    (home / 'SOUL.md').write_text('Perfil anterior personalizado.', encoding='utf-8')
    (home / 'memories/MEMORY.md').write_text('Recuerdo privado que debe conservarse.', encoding='utf-8')
    saved_files = {path: path.read_bytes() for path in home.rglob('*') if path.is_file()}
    updated_root = tmp_path / 'updated-platform'
    shutil.copytree(templates.ROOT / 'templates', updated_root / 'templates')
    profile_path = updated_root / 'templates/ux/template.json'
    profile = json.loads(profile_path.read_text(encoding='utf-8'))
    profile['delegation_contract']['returns'].append('Entrega nueva disponible en este turno.')
    profile_path.write_text(json.dumps(profile, ensure_ascii=False), encoding='utf-8')
    role_path = updated_root / 'templates/ux/SOUL.md'
    role_path.write_text(role_path.read_text(encoding='utf-8') + '\nInstrucción de rol actualizada.', encoding='utf-8')
    shared_path = updated_root / 'templates/delegation.md'
    shared_path.write_text(shared_path.read_text(encoding='utf-8') + '\nRegla común actualizada.', encoding='utf-8')
    monkeypatch.setattr(templates, 'ROOT', updated_root)
    instructions = platform_instructions(a, service.store)
    assert 'Entrega nueva disponible en este turno.' in instructions
    assert 'Instrucción de rol actualizada.' in instructions and 'Regla común actualizada.' in instructions
    assert all(path.read_bytes() == original for path, original in saved_files.items())
    roster = service.tool(b, 'list_project_agents', {})['agents']
    assert 'Entrega nueva disponible en este turno.' in next(row for row in roster if row['id'] == a['id'])['delegation_contract']['returns']


def test_busy_recipient_fails_without_calling_runtime(team, monkeypatch):
    service, a, b = team
    with patch('backend.service.threading.Thread'):
        task = service.tool(a, 'delegate_task', dict(agent_id=b['id'], task='Review', request_id='busy'))
    with service.lock(b['id']):
        service.run_delegated_task(task['id'])
    status = service.tool(a, 'get_task_status', {'task_id': task['id']})
    assert status['status'] == 'failed' and 'ocupado' in status['error']


@pytest.mark.parametrize(('readiness', 'diagnostic'), [
    ({'status': 'stopped', 'ready': False}, 'runtime del destinatario está apagado'),
    ({'status': 'starting', 'ready': False}, 'se está preparando'),
    ({'status': 'running', 'ready': True, 'busy': True}, 'destinatario está ocupado'),
])
def test_delegation_checks_live_readiness_and_reports_the_cause(team, monkeypatch, readiness, diagnostic):
    service, sender, recipient = team
    monkeypatch.setenv('OPENAI_API_KEY', 'test-only')
    service.store.execute("UPDATE agents SET status='running',container_id='stale' WHERE id=?", (recipient['id'],))
    service.runtime.inspect = lambda *_: readiness
    with patch('backend.service.threading.Thread'), patch.object(service.runtime, 'chat') as chat:
        task = service.delegate_task(sender, recipient['id'], 'Review', 'offline')
        service.run_delegated_task(task['id'])
        chat.assert_not_called()
    status = service.tool(sender, 'get_task_status', {'task_id': task['id']})
    assert status['status'] == 'failed' and diagnostic in status['error']
    assert service.messages(recipient['id']) == []


def test_mcp_direct_delegation_transport(tmp_path):
    from fastapi.testclient import TestClient
    from backend.app import create_app
    app = create_app(tmp_path, TestRuntime())
    service = app.state.service
    org = service.create_org('Studio')
    project = service.create_project(org['id'], 'Product')
    a = service.create_agent(project['id'], 'UX', 'ux')
    b = service.create_agent(project['id'], 'Design', 'graphic-designer')
    headers = {'Authorization': 'Bearer ' + service.store.token(a['id'], 'mcp'),
               'Accept': 'application/json, text/event-stream'}
    with TestClient(app, base_url='http://localhost') as client:
        roster_response = client.post('/mcp/', headers=headers, json={
            'jsonrpc': '2.0', 'id': 0, 'method': 'tools/call',
            'params': {'name': 'list_project_agents', 'arguments': {}}})
        assert roster_response.status_code == 200
        roster = json.loads(roster_response.json()['result']['content'][0]['text'])['agents']
        assert next(row for row in roster if row['id'] == b['id'])['delegation_contract']['required_inputs']
        with patch('backend.service.threading.Thread'):
            response = client.post('/mcp/', headers=headers, json={
                'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                'params': {'name': 'delegate_task', 'arguments': {
                    'agent_id': b['id'], 'task': 'Review', 'request_id': 'transport'}}})
        assert response.status_code == 200
        assert not response.json()['result'].get('isError', False)
        task = service.store.one('SELECT * FROM delegated_tasks')
        response = client.post('/mcp/', headers=headers, json={
            'jsonrpc': '2.0', 'id': 2, 'method': 'tools/call',
            'params': {'name': 'get_task_status', 'arguments': {'task_id': task['id']}}})
        assert not response.json()['result'].get('isError', False)
    restarted_app = create_app(tmp_path, TestRuntime())
    with TestClient(restarted_app, base_url='http://localhost'):
        assert service.store.one('SELECT status FROM delegated_tasks')['status'] == 'failed'
