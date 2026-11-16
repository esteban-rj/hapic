"""Operator API for the delegation panel; real SQLite, no model or Docker calls."""
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from test_platform import TestRuntime


@pytest.fixture
def panel(tmp_path, monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    app = create_app(tmp_path, TestRuntime())
    service = app.state.service
    with TestClient(app, base_url='http://localhost') as client:
        client.get('/api/bootstrap')
        org = service.create_org('Studio')
        project = service.create_project(org['id'], 'Product')
        sender = service.create_agent(project['id'], 'Lin', 'ux')
        recipient = service.create_agent(project['id'], 'Nora', 'graphic-designer')
        yield client, service, project, sender, recipient


def delegate(service, sender, recipient, request_id, **kwargs):
    with patch('backend.service.threading.Thread'):
        return service.tool(sender, 'delegate_task', {
            'agent_id': recipient['id'], 'task': 'Revisar el flujo de navegación',
            'request_id': request_id, **kwargs})


def test_empty_panel_and_input_validation(panel):
    client, service, project, sender, recipient = panel
    path = f"/api/projects/{project['id']}/delegations"
    response = client.get(path)
    assert response.status_code == 200
    assert response.json() == {'tasks': [], 'total': 0, 'limit': 20, 'offset': 0,
                               'counts': dict.fromkeys(('queued', 'running', 'completed', 'failed'), 0)}
    assert response.headers['cache-control'] == 'no-store'
    for query in ('limit=0', 'limit=101', 'offset=-1', 'limit=invalid'):
        assert client.get(path + '?' + query).status_code == 422
    assert client.get(path + '?status=unknown').status_code == 400
    assert client.get(path + '?agent_id=missing').status_code == 404
    assert client.get(path + '/missing').status_code == 404


def test_list_names_filters_counts_pagination_and_full_results(panel):
    client, service, project, sender, recipient = panel
    path = f"/api/projects/{project['id']}/delegations"
    created = []
    for index, status in enumerate(('queued', 'running', 'completed', 'failed')):
        task = delegate(service, sender, recipient, str(index), task='Revisión ' + 'x' * 300,
                        context='Dos acciones principales', expected_result='Recomendaciones con prioridad')
        service.store.execute('UPDATE delegated_tasks SET status=?,created_at=?,result=?,error=? WHERE id=?',
            (status, f'2026-11-11T10:0{index}:00+00:00',
             'Conservar una sola acción principal.\n<script>texto de trabajo</script>' if status == 'completed' else None,
             'Destinatario no disponible.' if status == 'failed' else None, task['id']))
        created.append(task['id'])
    first = client.get(path + '?limit=2').json()
    assert first['total'] == 4 and first['limit'] == 2
    assert first['counts'] == dict.fromkeys(('queued', 'running', 'completed', 'failed'), 1)
    assert [task['id'] for task in first['tasks']] == list(reversed(created[2:]))
    summary = first['tasks'][0]
    assert (summary['sender_id'], summary['sender_name'], summary['sender_kind']) == (sender['id'], 'Lin', 'ux')
    assert (summary['recipient_id'], summary['recipient_name'], summary['recipient_kind']) == (recipient['id'], 'Nora', 'graphic-designer')
    assert len(summary['task_preview']) == 200
    assert not {'result', 'context', 'expected_result', 'request_id'} & summary.keys()
    second = client.get(path + '?limit=2&offset=2').json()
    assert [task['id'] for task in second['tasks']] == list(reversed(created[:2]))
    assert not set(task['id'] for task in first['tasks']) & set(task['id'] for task in second['tasks'])
    filtered = client.get(path + '?status=completed').json()
    assert [task['id'] for task in filtered['tasks']] == [created[2]]
    assert filtered['total'] == 1 and filtered['counts'] == first['counts']
    for agent in (sender, recipient):
        assert client.get(path + '?agent_id=' + agent['id']).json()['total'] == 4
    unrelated = service.create_agent(project['id'], 'Planner', 'architect')
    assert client.get(path + '?agent_id=' + unrelated['id']).json()['total'] == 0
    detail = client.get(path + '/' + created[2]).json()
    assert detail['status'] == 'completed'
    assert detail['context'] == 'Dos acciones principales'
    assert detail['expected_result'] == 'Recomendaciones con prioridad'
    assert detail['result'] == 'Conservar una sola acción principal.\n<script>texto de trabajo</script>'
    assert len(detail['task']) > 200
    assert client.get(path + '/' + created[3]).json()['error'] == 'Destinatario no disponible.'


def test_panel_is_authenticated_and_scoped_to_project_membership(panel):
    client, service, project, sender, recipient = panel
    task = delegate(service, sender, recipient, 'private')
    path = f"/api/projects/{project['id']}/delegations"
    other_org = service.create_org('Other studio')
    other = service.create_project(other_org['id'], 'Other product')
    other_agent = service.create_agent(other['id'], 'Other UX', 'ux')
    assert client.get(f"/api/projects/{other['id']}/delegations").json()['tasks'] == []
    assert client.get(f"/api/projects/{other['id']}/delegations/{task['id']}").status_code == 404
    assert client.get(path + '?agent_id=' + other_agent['id']).status_code == 404
    assert client.get('/api/projects/missing/delegations').status_code == 404
    with TestClient(create_app(service.store.root, TestRuntime()), base_url='http://localhost') as anonymous:
        assert anonymous.get(path).status_code == 401
        assert anonymous.get(path + '/' + task['id']).status_code == 401
    service.store.execute('DELETE FROM memberships WHERE organization_id=?', (project['organization_id'],))
    assert client.get(path).status_code == 404
    assert client.get(path + '/' + task['id']).status_code == 404


def test_panel_reads_updated_status_and_result_from_sqlite(panel):
    client, service, project, sender, recipient = panel
    task = delegate(service, sender, recipient, 'changing')
    path = f"/api/projects/{project['id']}/delegations"
    assert client.get(path).json()['counts']['queued'] == 1
    assert client.get(path + '/' + task['id']).json()['result'] is None
    service.store.execute("UPDATE delegated_tasks SET status='completed',result=? WHERE id=?", ('Revisión terminada.', task['id']))
    page = client.get(path).json()
    assert page['counts']['queued'] == 0 and page['counts']['completed'] == 1
    assert page['tasks'][0]['status'] == 'completed'
    assert client.get(path + '/' + task['id']).json()['result'] == 'Revisión terminada.'
