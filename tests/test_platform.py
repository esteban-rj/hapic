"""Contract/integration tests. Docker and LLM doubles are confined to this test module."""
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import yaml
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.runtime import DockerRuntime, RuntimeUnavailable
from backend.service import Service, safe_path
from backend.storage import Store


class TestRuntime(DockerRuntime):
    __test__ = False

    def health(self):
        return {"available": False, "message": "Docker double: unavailable", "image": self.image}

    def start(self, agent, store):
        raise RuntimeUnavailable("Docker double: unavailable")

    def inspect(self, agent, store):
        return {"status": agent["status"], "ready": False}


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    return create_app(tmp_path, TestRuntime())


@pytest.fixture
def client(app):
    with TestClient(app, base_url="http://localhost") as client:
        csrf = client.get("/api/bootstrap").json()["csrf"]
        client.headers["X-Hapic-CSRF"] = csrf
        yield client


def project(client):
    org = client.post("/api/organizations", json={"name": "Estudio"}).json()
    return client.post(f"/api/organizations/{org['id']}/projects", json={"name": "Producto"}).json()


def test_organization_project_hapic_persist_after_restart(client, app):
    p = project(client)
    state = client.get("/api/state").json()
    assert len(state["organizations"]) == len(state["projects"]) == len(state["agents"]) == 1
    hapic = state["agents"][0]
    assert hapic["kind"] == "hapic" and hapic["status"] == "pending" and hapic["container_id"] is None
    assert hapic["model"] == "gpt-6.1-sol" and hapic["effort"] == "xhigh"
    home = app.state.store.agent_path(hapic) / "hermes"
    config = yaml.safe_load((home / "config.yaml").read_text())
    assert config["model"]["provider"] == "openai-api"
    assert config["model"]["api_mode"] == "codex_responses"
    assert config["agent"]["reasoning_effort"] == "xhigh"
    assert "SOUL.md" in json.dumps(client.get(f"/api/projects/{p['id']}/tree").json())
    restarted = Service(Store(app.state.store.root), TestRuntime())
    assert restarted.agent(hapic["id"])["name"] == "Hapic"
    assert (home / "memories/MEMORY.md").exists()


def test_no_fake_runtime_or_chat(client):
    p = project(client)
    agent = client.get("/api/state").json()["agents"][0]
    result = client.post(f"/api/agents/{agent['id']}/chat", json={"content": "Hola"})
    assert result.status_code == 503
    assert client.get(f"/api/agents/{agent['id']}/messages").json() == []
    assert client.post(f"/api/agents/{agent['id']}/start").status_code == 202
    agent = client.get("/api/state").json()["agents"][0]
    assert agent["status"] == "blocked" and agent["container_id"] is None
    ux = client.post(f"/api/projects/{p['id']}/agents", json={"name": "Nora"}).json()
    ux = next(a for a in client.get("/api/state").json()["agents"] if a["id"] == ux["id"])
    assert ux["status"] == "blocked"


def test_keys_encrypted_redacted_and_excluded(client, app):
    key = "sk-proj-" + "test" * 12
    result = client.put("/api/settings/openai", json={"api_key": key})
    assert result.status_code == 200 and key not in result.text
    assert key.encode() not in (app.state.store.secrets_dir / "openai.enc").read_bytes()
    assert client.get("/api/capabilities").json()["openai"]["configured"]
    assert key not in client.get("/api/state").text
    bad = client.put("/api/settings/openai", json={"api_key": key * 20})
    assert bad.status_code == 422 and key not in bad.text
    p = project(client)
    agent = client.get("/api/state").json()["agents"][0]
    result = client.post(f"/api/agents/{agent['id']}/chat", json={"content": key})
    assert result.status_code == 400 and key not in result.text
    assert client.delete("/api/settings/openai").status_code == 200
    assert not app.state.store.api_key()


def test_sessions_csrf_origin_and_membership(client, app):
    assert client.post("/api/organizations", json={"name": "no"}, headers={"X-Hapic-CSRF": "wrong"}).status_code == 403
    assert client.post("/api/organizations", json={"name": "no"}, headers={"Origin": "https://attacker.example"}).status_code == 403
    assert client.get("/api/state", headers={"Host": "attacker.example"}).status_code == 403
    p = project(client)
    app.state.store.execute("DELETE FROM memberships")
    assert client.get("/api/state").json()["projects"] == []
    assert client.get("/api/state").json()["agents"] == []
    assert client.get(f"/api/projects/{p['id']}/tree").status_code == 404
    assert client.post(f"/api/projects/{p['id']}/agents", json={"name": "Nora"}).status_code == 404


def test_file_traversal_and_secrets(client, app):
    p = project(client)
    agent = client.get("/api/state").json()["agents"][0]
    for path in ["../../secrets/master.key", "/etc/passwd", "C:/Windows/win.ini", "..\\secrets\\openai.enc", "workspace/.env", f"agents/{agent['id']}/hermes/config.yaml"]:
        assert client.get(f"/api/projects/{p['id']}/file", params={"path": path}).status_code == 400


def test_symlinks_rejected_when_supported(client, app, tmp_path):
    p = project(client)
    root = app.state.store.project_path(p) / "workspace"
    outside = tmp_path / "private.md"
    outside.write_text("private")
    try:
        (root / "linked.md").symlink_to(outside)
    except OSError:
        pytest.skip("Host does not permit symlink creation")
    assert client.get(f"/api/projects/{p['id']}/file", params={"path": "workspace/linked.md"}).status_code == 400


def test_mcp_scope_and_real_file_tools(client, app):
    p = project(client)
    ux = app.state.service.create_agent(p["id"], "Nora")
    other = app.state.service.create_agent(p["id"], "Otro")
    service = app.state.service
    assert service.tool(ux, "project_write_file", {"path": "brief.md", "content": "# Brief\nHipótesis pendiente de validar"})["saved"]
    assert service.tool(ux, "project_read_file", {"path": "brief.md"})["content"].startswith("# Brief")
    assert service.tool(other, "project_list_files", {}) == {"files": []}
    for path in ["../hermes/SOUL.md", f"../../{other['id']}/workspace/brief.md", "/etc/passwd", ".env", "config.yaml"]:
        with pytest.raises(ValueError):
            service.tool(ux, "project_write_file", {"path": path, "content": "bad"})
    with pytest.raises(PermissionError):
        service.tool(ux, "create_ux_agent", {"name": "No"})
    assert client.post("/mcp/", json={}).status_code == 401
    headers = {"Authorization": "Bearer " + app.state.store.token(ux["id"], "mcp"), "Accept": "application/json, text/event-stream"}
    result = client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "pytest", "version": "1"}}})
    assert result.status_code == 200 and "serverInfo" in result.json()["result"]
    result = client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "project_read_file", "arguments": {"path": "brief.md"}}})
    assert result.status_code == 200 and "Hipótesis" in result.text
    result = client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "create_ux_agent", "arguments": {"name": "No"}}})
    assert result.json()["result"]["isError"]


def test_model_changes_apply_and_clean_template(client, app):
    p = project(client)
    store = app.state.store
    hapic = client.get("/api/state").json()["agents"][0]
    (store.agent_path(hapic) / "hermes/memories/MEMORY.md").write_text("PRIVATE MEMORY")
    assert client.put("/api/settings/model", json={"model": "gpt-6.1-sol", "effort": "high"}).status_code == 200
    nora = app.state.service.create_agent(p["id"], "Nora")
    assert nora["effort"] == "high"
    assert "PRIVATE MEMORY" not in (store.agent_path(nora) / "hermes/memories/MEMORY.md").read_text()
    assert (store.agent_path(nora) / "hermes/skills/ux-method/SKILL.md").exists()
    assert client.put(f"/api/agents/{nora['id']}/model", json={"model": "gpt-6.1-sol", "effort": "low"}).status_code == 200
    assert client.put("/api/settings/model", json={"model": "gpt-6.1-sol", "effort": "none"}).status_code == 400


def test_chat_contract_with_hermes_double(client, app):
    p = project(client)
    agent = client.get("/api/state").json()["agents"][0]
    app.state.store.secret("openai", "test-key-never-sent-to-openai")
    app.state.store.execute("UPDATE agents SET container_id='docker-double' WHERE id=?", (agent["id"],))

    class ConversationalDouble(TestRuntime):
        async def chat(self, a, store, text, request_id):
            assert a["model"] == "gpt-6.1-sol" and a["effort"] == "xhigh"
            if text == "Crea un agente UX":
                return "¿Cómo quieres llamar al nuevo agente UX?", "completed"
            app.state.service.tool(a, "create_ux_agent", {"name": text})
            return f"El perfil {text} está creado; su runtime sigue pendiente.", "completed"
    app.state.service.runtime = ConversationalDouble()
    for text, rid in [("Crea un agente UX", "first"), ("Nora", "second")]:
        assert client.post(f"/api/agents/{agent['id']}/chat", json={"content": text, "request_id": rid}).status_code == 200
    retry = client.post(f"/api/agents/{agent['id']}/chat", json={"content": "Nora", "request_id": "second"})
    assert retry.status_code == 200
    assert len(client.get(f"/api/agents/{agent['id']}/messages").json()) == 4
    assert len(client.get("/api/state").json()["agents"]) == 2
    assert client.post(f"/api/agents/{agent['id']}/chat", json={"content": "Otro", "request_id": "second"}).status_code == 409


def test_hermes_wire_uses_responses_not_chat_completions(client, app):
    import asyncio
    p = project(client)
    agent = client.get("/api/state").json()["agents"][0]
    agent["container_id"] = "double"
    runtime = DockerRuntime()
    fake_container = MagicMock()
    fake_container.attrs = {"NetworkSettings": {"Ports": {"8642/tcp": [{"HostPort": "12345"}]}}}
    fake_client = MagicMock()
    fake_client.containers.get.return_value = fake_container
    seen = []

    async def handler(request):
        import httpx
        seen.append(request)
        return httpx.Response(200, json={"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": "Hola"}]}]})
    import httpx
    real_async_client = httpx.AsyncClient
    with patch.object(runtime, "client", return_value=fake_client), patch("backend.runtime.httpx.AsyncClient", side_effect=lambda **kwargs: real_async_client(transport=httpx.MockTransport(handler))):
        answer, status = asyncio.run(runtime.chat(agent, app.state.store, "Hola", "request-123"))
    assert answer == "Hola" and status == "completed"
    request = seen[0]
    assert request.url.path == "/v1/responses"
    payload = json.loads(request.content)
    assert payload["provider"] == "openai-api" and payload["model_options"]["reasoning_effort"] == "xhigh"
    assert request.headers["Idempotency-Key"] == "request-123"


def test_docker_lifecycle_contract_and_readiness(client, app, monkeypatch):
    import docker
    import httpx
    monkeypatch.delenv("HAPIC_IN_DOCKER", raising=False)
    p = project(client)
    agent = client.get("/api/state").json()["agents"][0]
    store = app.state.store
    store.secret("openai", "test-key-only-for-a-docker-double")
    runtime = DockerRuntime()
    sdk = MagicMock()
    sdk.containers.get.side_effect = docker.errors.NotFound("not found")
    container = MagicMock()
    container.id = "test-container-id"
    container.status = "running"
    container.attrs = {"NetworkSettings": {"Ports": {"8642/tcp": [{"HostPort": "12345"}]}}}
    sdk.containers.run.return_value = container
    with patch.object(runtime, "client", return_value=sdk), patch("backend.runtime.httpx.get", return_value=httpx.Response(200, json={"status": "ok"})):
        result = runtime.start(agent, store)
    assert result["status"] == "running"
    args, kwargs = sdk.containers.run.call_args
    assert args[1] == ["gateway", "run"]
    assert len(kwargs["volumes"]) == 2
    assert not any("docker.sock" in x for x in kwargs["volumes"])
    assert kwargs["ports"]["8642/tcp"][0] == "127.0.0.1"
    assert kwargs["environment"]["HERMES_HOME"] == "/opt/data"
    assert kwargs["environment"]["OPENAI_API_KEY"] == store.api_key()
    config = yaml.safe_load((store.agent_path(agent) / "hermes/config.yaml").read_text())
    assert config["platform_toolsets"]["api_server"] == ["memory", "hapic"]
    assert store.api_key() not in json.dumps(config)
    with patch.object(runtime, "client", return_value=sdk), patch("backend.runtime.httpx.get", return_value=httpx.Response(200, json={"status": "degraded"})), patch("backend.runtime.time.sleep"):
        with pytest.raises(RuntimeUnavailable, match="aún no está lista"):
            runtime.start(agent, store)
