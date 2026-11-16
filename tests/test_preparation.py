"""Exercise actual provisioning milestones with Docker/HTTP doubles, without inference."""
import json
from unittest.mock import MagicMock, patch

import docker
import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.preparation import Preparation, STEPS
from backend.service import Service
from backend.storage import Store


@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-only-never-a-real-credential")
    monkeypatch.delenv("HAPIC_IN_DOCKER", raising=False)
    store = Store(tmp_path)
    service = Service(store)
    org = service.create_org("Studio")
    project = service.create_project(org["id"], "Launch")
    agent = store.one("SELECT * FROM agents WHERE project_id=?", (project["id"],))
    sdk = MagicMock()
    sdk.containers.get.side_effect = docker.errors.NotFound("missing")
    container = sdk.containers.run.return_value
    container.id = "test-container"
    container.status = "running"
    container.attrs = {"NetworkSettings": {"Ports": {"8642/tcp": [{"HostPort": "12345"}]}}}
    with patch.object(service.runtime, "client", return_value=sdk), patch("backend.runtime.httpx.get", return_value=httpx.Response(200, json={"status": "ok"})), patch("backend.runtime.time.sleep"):
        yield service, agent, sdk


def snapshot(service, agent):
    return Preparation.current(service.store, agent["id"]).snapshot()


def test_pending_profile_then_full_provisioning_persists(setup):
    service, agent, sdk = setup
    pending = snapshot(service, agent)
    assert pending["completed"] == 1 and pending["status"] == "pending"
    assert [step["id"] for step in pending["steps"]] == [name for name, _, _ in STEPS]
    assert all(step["status"] == "pending" for step in pending["steps"][1:])
    service.provision(agent["id"])
    completed = snapshot(service, agent)
    assert completed["status"] == "completed" and completed["completed"] == completed["total"] == 7
    assert all(step["logs"] and step["duration_seconds"] >= 0 for step in completed["steps"])
    assert Preparation.current(Store(service.store.root), agent["id"]).snapshot() == completed
    sdk.images.pull.assert_not_called()


def test_download_reports_actual_current_stage(setup):
    service, agent, sdk = setup
    sdk.images.get.side_effect = docker.errors.ImageNotFound("missing")
    def during_download(_):
        progress = snapshot(service, agent)
        image = next(step for step in progress["steps"] if step["id"] == "image")
        assert image["status"] == "running"
        assert "Descargando" in image["logs"][-1]["message"]
        assert all(step["status"] == "pending" for step in progress["steps"][-2:])
        assert service.agent(agent["id"])["status"] == "provisioning"
    sdk.images.pull.side_effect = during_download
    service.provision(agent["id"])
    sdk.images.pull.assert_called_once()
    assert snapshot(service, agent)["completed"] == 7


@pytest.mark.parametrize("failure", ["key", "docker", "image", "lookup", "container", "readiness"])
def test_failure_leaves_later_steps_pending_without_secrets(setup, monkeypatch, failure):
    service, agent, sdk = setup
    secret = "sk-proj-sensitive-value-that-must-never-appear"
    expected_step = {"key": "requirements", "docker": "requirements", "image": "image", "lookup": "container", "container": "container", "readiness": "readiness"}[failure]
    if failure == "key":
        monkeypatch.delenv("OPENAI_API_KEY")
    elif failure == "image":
        sdk.images.get.side_effect = docker.errors.ImageNotFound("missing")
        sdk.images.pull.side_effect = RuntimeError(secret)
    elif failure == "container":
        sdk.containers.run.side_effect = RuntimeError(secret)
    elif failure == "lookup":
        sdk.containers.get.side_effect = docker.errors.DockerException(secret)
    with patch.object(service.runtime, "client", side_effect=docker.errors.DockerException(secret)) if failure == "docker" else patch("backend.runtime.httpx.get", return_value=httpx.Response(200, json={"status": "degraded" if failure == "readiness" else "ok"})):
        result = service.provision(agent["id"])
    progress = snapshot(service, agent)
    index = next(i for i, step in enumerate(progress["steps"]) if step["id"] == expected_step)
    assert progress["steps"][index]["status"] in {"failed", "blocked"}
    assert all(step["status"] == "pending" for step in progress["steps"][index + 1:])
    assert secret not in json.dumps(progress) + json.dumps(result)
    assert progress["status"] != "completed"


def test_retry_keeps_failed_attempt_and_restarts_progress(setup, monkeypatch):
    service, agent, _ = setup
    monkeypatch.delenv("OPENAI_API_KEY")
    service.provision(agent["id"])
    failed = snapshot(service, agent)
    monkeypatch.setenv("OPENAI_API_KEY", "test-credential")
    service.provision(agent["id"])
    retried = snapshot(service, agent)
    assert retried["id"] != failed["id"] and retried["completed"] == 7
    assert Preparation(service.store, failed["id"]).snapshot() == failed


def test_api_membership_localization_restart_and_preparing_precedence(setup):
    service, agent, _ = setup
    progress = Preparation.begin(service.store, agent["id"])
    progress.start("requirements", "Comprobando la conexión con Docker y la credencial de OpenAI.")
    service.store.execute("UPDATE agents SET status='provisioning' WHERE id=?", (agent["id"],))
    app = create_app(service.store.root, service.runtime)
    with TestClient(app, base_url="http://localhost") as client:
        client.headers["X-Hapic-CSRF"] = client.get("/api/bootstrap").json()["csrf"]
        path = f"/api/agents/{agent['id']}/preparation"
        data = client.get(path, headers={"Accept-Language": "en"}).json()
        assert data["status"] == "blocked" and data["steps"][0]["label"] == "Profile and memory"
        assert data["steps"][1]["status"] == "blocked"
        assert "restarted" in data["steps"][1]["logs"][-1]["message"]
        service.store.execute("UPDATE agents SET status='provisioning' WHERE id=?", (agent["id"],))
        assert client.get(f"/api/agents/{agent['id']}/runtime").json() == {"status": "provisioning", "ready": False}
        assert client.get("/api/agents/unknown/preparation").status_code == 404
        service.store.execute("DELETE FROM memberships")
        assert client.get(path).status_code == 404


def test_legacy_profile_has_no_invented_milestones(setup):
    service, agent, _ = setup
    service.store.execute("DELETE FROM preparation_steps")
    service.store.execute("DELETE FROM agent_preparations")
    app = create_app(service.store.root, service.runtime)
    with TestClient(app, base_url="http://localhost") as client:
        client.get("/api/bootstrap")
        assert client.get(f"/api/agents/{agent['id']}/preparation").json() is None
    service.provision(agent["id"])
    assert snapshot(service, agent)["completed"] == 7


def test_incomplete_profile_cannot_be_reported_as_prepared_on_retry(setup):
    service, agent, _ = setup
    progress = Preparation.current(service.store, agent['id'])
    progress.fail('failed', 'Profile interrupted')
    (service.store.agent_path(agent) / 'hermes/SOUL.md').unlink()
    result = service.provision(agent['id'])
    progress = snapshot(service, agent)
    assert result['status'] == 'blocked'
    assert progress['completed'] == 0
    assert progress['steps'][0]['status'] == 'blocked'
    assert all(step['status'] == 'pending' for step in progress['steps'][1:])
