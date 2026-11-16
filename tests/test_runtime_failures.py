"""Hermes may return HTTP 200 for a failed provider call. Never expose its raw error."""
import asyncio
from unittest.mock import MagicMock, patch

import httpx
import pytest

from backend.runtime import DockerRuntime, RuntimeUnavailable
from backend.service import Service
from backend.storage import Store
from test_platform import TestRuntime


@pytest.mark.parametrize('error', [
    {'code': 'invalid_api_key', 'message': 'Incorrect API key provided: sk-proj-private-fragment'},
    {'code': 'agent_error', 'message': 'HTTP 401: Incorrect API key provided: sk-proj-private-fragment'},
    {'code': 'agent_error', 'message': 'Error code: 401 - private provider response'},
    'AuthenticationError: private provider response',
])
def test_failed_provider_authentication_is_actionable_and_redacted(tmp_path, error):
    store = Store(tmp_path)
    service = Service(store, TestRuntime())
    org = service.create_org('Studio')
    project = service.create_project(org['id'], 'Product')
    agent = store.one('SELECT * FROM agents WHERE project_id=?', (project['id'],))
    agent['container_id'] = 'test-runtime'
    runtime = DockerRuntime()
    container = MagicMock()
    container.attrs = {'NetworkSettings': {'Ports': {'8642/tcp': [{'HostPort': '12345'}]}}}
    docker_client = MagicMock()
    docker_client.containers.get.return_value = container
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={'status': 'failed', 'error': error, 'output': []}))
    real_client = httpx.AsyncClient
    with patch.object(runtime, 'client', return_value=docker_client), patch('backend.runtime.httpx.AsyncClient', side_effect=lambda **kwargs: real_client(transport=transport)):
        with pytest.raises(RuntimeUnavailable) as failure:
            asyncio.run(runtime.chat(agent, store, 'Hola', 'auth-failed'))
    message = str(failure.value)
    assert '401' in message and 'Configuración' in message and 'reinicia' in message
    assert 'sk-' not in message and 'private' not in message


@pytest.mark.parametrize('status,error,expected', [
    ('cancelled', {'code': 'agent_error', 'message': 'raw provider text'}, 'canceló'),
    ('failed', {'code': 'unknown', 'message': 'raw provider text'}, 'no completó'),
    ('failed', None, 'no completó'),
])
def test_other_failures_keep_safe_messages(status, error, expected):
    from backend.runtime import failed_response_message
    message = failed_response_message({'status': status, 'error': error})
    assert expected in message
    assert 'raw provider text' not in message
