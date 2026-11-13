"""Exercise Hermes error envelopes through the chat API, without Docker or inference."""
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.runtime import safe_error_detail


@pytest.fixture
def chat(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("HAPIC_IN_DOCKER", raising=False)
    app = create_app(tmp_path)
    service, store = app.state.service, app.state.store
    org = service.create_org("Estudio")
    project = service.create_project(org["id"], "Errores")
    agent = store.one("SELECT * FROM agents WHERE project_id=?", (project["id"],))
    store.secret("openai", "current-openai-secret-for-tests")
    store.execute("UPDATE agents SET container_id='docker-double' WHERE id=?", (agent["id"],))
    sdk = MagicMock()
    sdk.containers.get.return_value.attrs = {
        "NetworkSettings": {"Ports": {"8642/tcp": [{"HostPort": "12345"}]}}}
    real_async_client = httpx.AsyncClient
    with TestClient(app, base_url="http://localhost") as client:
        client.headers["X-Hapic-CSRF"] = client.get("/api/bootstrap").json()["csrf"]

        def send(response, language="es"):
            async def handler(request):
                if isinstance(response, Exception):
                    raise response
                return response

            with patch.object(service.runtime, "client", return_value=sdk), patch(
                "backend.runtime.httpx.AsyncClient",
                side_effect=lambda **kwargs: real_async_client(transport=httpx.MockTransport(handler), **kwargs),
            ):
                return client.post(f"/api/agents/{agent['id']}/chat", headers={"Accept-Language": language}, json={
                    "content": "Hola", "request_id": uuid4().hex})

        yield send, store, agent


@pytest.mark.parametrize("http_status,payload,expected", [
    (200, {"status": "failed", "error": {"code": "invalid_api_key"}}, "OpenAI rejected the inference API key"),
    (401, {"error": {"message": "Invalid API key"}}, "Hermes rejected authentication to its API (HTTP 401)"),
    (429, {"error": {"message": "Quota exceeded"}}, "Hermes returned HTTP 429. Cause: Quota exceeded"),
    (200, {"status": "cancelled", "error": {"message": "Gateway shutdown"}}, "Hermes canceled the turn."),
    (200, {"status": "failed"}, "Hermes provided no error details"),
])
def test_hermes_failures_follow_the_selected_language(chat, http_status, payload, expected):
    send, store, agent = chat
    response = send(httpx.Response(http_status, json=payload), language="en")
    assert response.status_code == 503
    assert response.headers["Content-Language"] == "en"
    assert expected in response.json()["detail"]
    assert "Causa:" not in response.json()["detail"]


@pytest.mark.parametrize("http_status,payload", [
    (200, {"status": "failed", "error": {"code": "invalid_api_key", "message": "Incorrect API key provided"}}),
    (200, {"status": "failed", "error": "Error code: 401 - Incorrect API key provided: sk-proj-old****1234"}),
    (200, {"status": "failed", "error": {"type": "authentication_error", "message": "Unauthorized"}}),
    (200, {"status": "failed", "output": [{"type": "message", "content": [
        {"type": "output_text", "text": "AuthenticationError: Incorrect API key provided"}]}]}),
    (500, {"error": {"code": "invalid_api_key", "message": "Incorrect API key provided"}}),
    (401, {"error": {"code": "invalid_api_key", "message": "Incorrect API key provided"}}),
])
def test_invalid_inference_key_is_actionable_in_chat_and_activity(chat, http_status, payload):
    send, store, agent = chat
    response = send(httpx.Response(http_status, json=payload))
    assert response.status_code == 503
    detail = response.json()["detail"]
    assert "OpenAI rechazó la API key de inferencia" in detail
    assert "401" in detail
    assert "Configuración" in detail and "reinicia el runtime" in detail
    assert "sk-proj-" not in detail
    assert store.one("SELECT message FROM events ORDER BY id DESC LIMIT 1")["message"] == detail
    assert store.all("SELECT * FROM messages WHERE role='assistant'") == []


@pytest.mark.parametrize("http_status,payload,expected", [
    (429, {"error": {"code": "insufficient_quota", "message": "You exceeded your current quota"}}, "current quota"),
    (200, {"status": "failed", "error": {"code": "model_not_found", "message": "The model is unavailable"}}, "model_not_found"),
    (400, {"error": {"message": "Unsupported reasoning_effort: max"}}, "Unsupported reasoning_effort: max"),
    (500, {"error": {"type": "server_error", "message": "Provider temporarily unavailable"}}, "Provider temporarily unavailable"),
    (200, {"status": "failed", "error": "MCP tool timed out"}, "MCP tool timed out"),
    (400, {"detail": "Invalid conversation identifier"}, "Invalid conversation identifier"),
    (200, {"status": "cancelled", "error": {"message": "Gateway shutdown interrupted the run"}}, "Gateway shutdown interrupted the run"),
])
def test_hermes_causes_are_preserved_in_chat_and_activity(chat, http_status, payload, expected):
    send, store, agent = chat
    response = send(httpx.Response(http_status, json=payload))
    assert response.status_code == 503
    detail = response.json()["detail"]
    assert expected in detail
    assert store.one("SELECT message FROM events ORDER BY id DESC LIMIT 1")["message"] == detail
    if http_status >= 400:
        assert f"HTTP {http_status}" in detail
    if payload.get("status") == "cancelled":
        assert "Hermes canceló el turno" in detail


@pytest.mark.parametrize("http_status", [401, 403])
def test_hermes_api_authentication_is_distinct_from_openai_authentication(chat, http_status):
    send, store, agent = chat
    response = send(httpx.Response(http_status, json={"error": {"message": "Invalid API key"}}))
    assert response.status_code == 503
    detail = response.json()["detail"]
    assert "Hermes rechazó la autenticación de su API" in detail
    assert "sincronizar su token" in detail
    assert "OpenAI rechazó" not in detail


def test_secrets_are_redacted_before_errors_reach_chat_and_persisted_activity(chat):
    send, store, agent = chat
    secrets = [store.api_key(), store.token(agent["id"], "api"), store.token(agent["id"], "mcp"),
               "sk-proj-stale****1234", "opaque-bearer-secret", "opaque-api-secret",
               "opaque-access-secret", "opaque-refresh-secret", "opaque-client-secret"]
    message = (
        f"Model unavailable. {secrets[0]} {secrets[1]} {secrets[2]} {secrets[3]} "
        f"Authorization: Bearer {secrets[4]}, "
        f'"api_key": "{secrets[5]}", access_token={secrets[6]}, '
        f"refresh_token='{secrets[7]}', client_secret: {secrets[8]}"
    )
    response = send(httpx.Response(200, json={"status": "failed", "error": {"message": message}}))
    assert response.status_code == 503
    assert "Model unavailable" in response.json()["detail"]
    assert "REDACTADO" in response.json()["detail"]
    persisted = str(store.all("SELECT * FROM events")) + str(store.all("SELECT * FROM messages"))
    for secret in secrets:
        assert secret not in response.text
        assert secret not in persisted


def test_error_details_are_bounded_and_control_characters_removed():
    secret = "sk-proj-" + "a" * 1000
    detail = safe_error_detail("\x1b[31mFailure\x1b[0m\n" + secret + "\x00\n" + "x" * 2000, ())
    assert detail.startswith("Failure [REDACTADO] ")
    assert "sk-proj-" not in detail and "\x1b" not in detail and "\x00" not in detail
    assert len(detail) == 801 and detail.endswith("…")


@pytest.mark.parametrize("status", ["failed", "cancelled"])
def test_missing_error_detail_has_an_honest_fallback(chat, status):
    send, store, agent = chat
    response = send(httpx.Response(200, json={"status": status, "error": None}))
    assert response.status_code == 503
    assert "Hermes no proporcionó detalles" in response.json()["detail"]
    assert "Hermes no completó el turno" not in response.json()["detail"]


@pytest.mark.parametrize("response", [
    httpx.Response(502, text="<html>Private proxy details sk-proj-do-not-display</html>"),
    httpx.Response(502, json=["private proxy details"]),
    httpx.Response(401, text="Unauthorized"),
])
def test_non_json_or_malformed_http_errors_keep_the_http_status(chat, response):
    send, store, agent = chat
    result = send(response)
    assert result.status_code == 503
    assert f"HTTP {response.status_code}" in result.json()["detail"]
    assert "proxy details" not in result.text and "sk-proj-" not in result.text


@pytest.mark.parametrize("response", [
    httpx.Response(200, text="not JSON"),
    httpx.Response(200, json=[]),
    httpx.Response(200, json={"status": "completed", "output": [None, {"type": "message", "content": [None]}]}),
    httpx.ReadTimeout("Request headers: Bearer private-token"),
])
def test_malformed_successes_and_transport_errors_fail_without_leaking_or_crashing(chat, response):
    send, store, agent = chat
    result = send(response)
    assert result.status_code == 503
    assert "private-token" not in result.text


@pytest.mark.parametrize("status", ["completed", "incomplete"])
def test_chat_can_succeed_after_a_failed_turn_and_preserves_usable_partial_answers(chat, status):
    send, store, agent = chat
    assert send(httpx.Response(200, json={"status": "failed", "error": "Tool timed out"})).status_code == 503
    response = send(httpx.Response(200, json={"status": status, "output": [
        {"type": "message", "content": [{"type": "output_text", "text": "Hola"}]}]}))
    assert response.status_code == 200
    assert response.json() == {"content": "Hola", "status": status}
    assert [row["content"] for row in store.all("SELECT content FROM messages WHERE role='assistant'")] == ["Hola"]
