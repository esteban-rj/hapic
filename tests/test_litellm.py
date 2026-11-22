import json
from unittest.mock import MagicMock

import httpx
import yaml

from backend import litellm
from backend.runtime import DockerRuntime, gateway_configuration_changed
from test_platform import app, client, project


def test_virtual_key_catalog_and_models_without_openai(client, app, monkeypatch):
    monkeypatch.setenv("HAPIC_LITELLM_BASE_URL", "http://gateway:4000/v1/")
    monkeypatch.setenv("HAPIC_LITELLM_DASHBOARD_URL", "http://localhost:4000/ui")
    monkeypatch.setenv("HAPIC_LITELLM_BEST_MODEL", "best-model")
    monkeypatch.delenv("HAPIC_LITELLM_API_KEY", raising=False)
    # Create the profile before saving a key to avoid starting Docker in this test.
    project(client)
    store = app.state.store
    agent = client.get("/api/state").json()["agents"][0]
    assert agent["model"] == "auto"
    assert client.get("/api/capabilities").json()["litellm"]["dashboard_url"] == "http://localhost:4000/ui"
    assert not client.get("/api/capabilities").json()["openai"]["configured"]

    virtual_key = "sk-test-virtual-key-that-is-not-real"

    def catalog(request):
        assert str(request.url) == "http://gateway:4000/v1/models"
        if request.headers["authorization"] != f"Bearer {virtual_key}":
            return httpx.Response(401, json={"error": "bad key"})
        return httpx.Response(200, json={"data": [
            {"id": "providers/claude-sonnet"}, {"id": "gemini-flash"}, {"id": "best-model"},
            {"id": "best-model"}, {"id": "invalid\nmodel"},
        ]})

    real_httpx_client = httpx.Client
    monkeypatch.setattr(litellm.httpx, "Client", lambda **kwargs: real_httpx_client(transport=httpx.MockTransport(catalog), **kwargs))
    assert client.put("/api/settings/litellm", json={"api_key": "sk-wrong-key-test-value"}).status_code == 400
    saved = client.put("/api/settings/litellm", json={"api_key": virtual_key})
    assert saved.json() == {"configured": True}
    assert store.secret("litellm") == virtual_key
    caps = client.get("/api/capabilities")
    assert virtual_key not in caps.text
    assert caps.json()["litellm"]["models"] == ["best-model", "gemini-flash", "providers/claude-sonnet"]

    config = yaml.safe_load((store.agent_path(agent) / "hermes/config.yaml").read_text())
    assert config["model"]["default"] == "best-model"
    assert config["providers"]["litellm"]["transport"] == "codex_responses"
    assert virtual_key not in yaml.safe_dump(config)
    store.execute("UPDATE agents SET container_id='test' WHERE id=?", (agent["id"],))
    runtime = DockerRuntime()
    app.state.service.runtime = runtime
    container = MagicMock(labels={"hapic.litellm": litellm.runtime_signature(store)})
    container.attrs = {"NetworkSettings": {"Ports": {"8642/tcp": [{"HostPort": "12345"}]}}}
    monkeypatch.setattr(runtime, "client", lambda: MagicMock(containers=MagicMock(get=lambda _: container)))
    calls = []

    def hermes(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"output": [{"type": "message", "content": [{"type": "output_text", "text": "OK"}]}]})

    real_async_client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: real_async_client(transport=httpx.MockTransport(hermes), **kwargs))
    endpoint = f"/api/agents/{agent['id']}"
    assert client.post(endpoint + "/chat", json={"content": "Hola", "request_id": "best"}).is_success
    assert client.put(endpoint + "/model", json={"model": "providers/claude-sonnet", "effort": "high"}).is_success
    assert client.post(endpoint + "/chat", json={"content": "Hola", "request_id": "fixed"}).is_success
    assert [call["model"] for call in calls] == ["best-model", "providers/claude-sonnet"]
    assert all(call["provider"] == "custom:litellm" and "model_options" not in call for call in calls)
    assert calls[0]["conversation"] == calls[1]["conversation"]
    store.execute("UPDATE agents SET model='retired-model' WHERE id=?", (agent["id"],))
    assert client.post(endpoint + "/chat", json={"content": "Hola", "request_id": "retired"}).is_success
    assert calls[-1]["model"] == "best-model"
    store.secret("litellm", "sk-test-replaced-key-not-real")
    assert gateway_configuration_changed(container, store)
