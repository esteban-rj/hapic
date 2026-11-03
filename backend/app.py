from __future__ import annotations

import json
import os
import re
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, Field

from .runtime import RuntimeUnavailable
from .service import Service, safe_path
from .storage import DEFAULT_MODEL, EFFORTS, ROOT, Store, now, uid


class NameInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ModelInput(BaseModel):
    model: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9._-]+$")
    effort: str


class KeyInput(BaseModel):
    api_key: str = Field(min_length=20, max_length=512, repr=False)


class ChatInput(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)
    request_id: str = Field(default_factory=lambda: uid("msg"), max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")


def create_app(data_dir: Path | None = None, runtime=None):
    store = Store(data_dir or Path(os.getenv("HAPIC_DATA_DIR", str(ROOT / ".hapic"))))
    service = Service(store, runtime)
    # MCP remains private on the Docker network; an independent scoped token gates all requests.
    mcp = FastMCP("Hapic project tools", stateless_http=True, json_response=True, streamable_http_path="/", transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=True, allowed_hosts=["localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*", "host.docker.internal:*", "hapic:*"], allowed_origins=[]))

    def scope(ctx):
        request = ctx.request_context.request
        return service.scope(request.headers.get("authorization", "").removeprefix("Bearer "))

    @mcp.tool()
    def get_ux_template(ctx: Context) -> dict:
        """Lee la plantilla UX versionada antes de crear un especialista."""
        return service.tool(scope(ctx), "get_ux_template", {})

    @mcp.tool()
    def create_ux_agent(name: str, ctx: Context) -> dict:
        """Crea un agente UX en el proyecto autorizado. Pregunta antes su nombre al usuario. Devuelve estado real, no garantiza readiness."""
        return service.tool(scope(ctx), "create_ux_agent", {"name": name})

    @mcp.tool()
    def project_list_files(ctx: Context) -> dict:
        """Lista los documentos del workspace del agente en su proyecto autorizado."""
        return service.tool(scope(ctx), "project_list_files", {})

    @mcp.tool()
    def project_read_file(path: str, ctx: Context) -> dict:
        """Lee un documento del workspace autorizado. Rutas relativas, sin enlaces."""
        return service.tool(scope(ctx), "project_read_file", {"path": path})

    @mcp.tool()
    def project_write_file(path: str, content: str, ctx: Context) -> dict:
        """Guarda un entregable de texto en el workspace autorizado, hasta 256 KB."""
        return service.tool(scope(ctx), "project_write_file", {"path": path, "content": content})

    @asynccontextmanager
    async def lifespan(app):
        # Interrupted provisioning becomes retryable after a control-plane restart.
        store.execute("UPDATE agents SET status='pending',error='La plataforma se reinició durante la provisión. Comprueba el runtime y reintenta.' WHERE status='provisioning'")
        async with mcp.session_manager.run():
            yield

    app = FastAPI(title="Hapic", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.service = service
    app.state.store = store

    @app.middleware("http")
    async def security(request: Request, call_next):
        path = request.url.path
        if path.startswith("/mcp"):
            try:
                service.scope(request.headers.get("authorization", "").removeprefix("Bearer "))
            except PermissionError:
                return JSONResponse({"detail": "Autorización MCP requerida."}, status_code=401)
        else:
            host = request.url.hostname
            if host not in {"localhost", "127.0.0.1", "::1"}:
                return JSONResponse({"detail": "Esta versión solo permite acceso local."}, status_code=403)
            if path.startswith("/api/") and path not in {"/api/bootstrap", "/api/health"}:
                session = store.one("SELECT * FROM sessions WHERE token=?", (request.cookies.get("hapic_session", ""),))
                if not session:
                    return JSONResponse({"detail": "Abre la plataforma para iniciar una sesión local."}, status_code=401)
                if request.method not in {"GET", "HEAD", "OPTIONS"}:
                    origin = request.headers.get("origin")
                    if origin and (urlparse(origin).netloc != request.headers.get("host") or urlparse(origin).scheme != request.url.scheme):
                        return JSONResponse({"detail": "Origen no autorizado."}, status_code=403)
                    if not secrets.compare_digest(request.headers.get("x-hapic-csrf", ""), session["csrf"]):
                        return JSONResponse({"detail": "Sesión inválida. Recarga la página."}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ValueError)
    async def value_error(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        # Pydantic's default error includes input values, which can contain an API key.
        return JSONResponse({"detail": "Datos no válidos. Revisa el formato y la longitud de los campos."}, status_code=422)

    @app.exception_handler(LookupError)
    async def lookup_error(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=404)

    @app.exception_handler(RuntimeUnavailable)
    async def runtime_error(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=503)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "hapic-control-plane"}

    @app.get("/api/bootstrap")
    def bootstrap(request: Request, response: Response):
        session = store.one("SELECT * FROM sessions WHERE token=?", (request.cookies.get("hapic_session", ""),))
        if not session:
            session = {"token": secrets.token_urlsafe(32), "csrf": secrets.token_urlsafe(32), "created_at": now()}
            store.execute("INSERT INTO sessions VALUES (:token,:csrf,:created_at)", session)
        response.set_cookie("hapic_session", session["token"], httponly=True, samesite="strict", secure=request.url.scheme == "https", max_age=86400)
        return {"csrf": session["csrf"], "user": {"id": "local-owner", "name": "Espacio local"}, "mode": "local"}

    @app.get("/api/state")
    def state():
        return {"organizations": store.all("SELECT o.* FROM organizations o JOIN memberships m ON o.id=m.organization_id WHERE m.user_id='local-owner'"), "projects": store.all("SELECT p.* FROM projects p JOIN memberships m ON p.organization_id=m.organization_id WHERE m.user_id='local-owner'"), "agents": store.all("SELECT a.* FROM agents a JOIN memberships m ON a.organization_id=m.organization_id WHERE m.user_id='local-owner'"), "settings": store.setting("model", {"model": DEFAULT_MODEL, "effort": "xhigh"})}

    @app.get("/api/capabilities")
    def capabilities():
        return {"docker": service.runtime.health(), "openai": {"configured": bool(store.api_key()), "source": "environment" if os.getenv("OPENAI_API_KEY") else "server"}, "local_only": True}

    @app.post("/api/organizations", status_code=201)
    def create_organization(body: NameInput):
        return service.create_org(body.name)

    @app.post("/api/organizations/{org_id}/projects", status_code=201)
    def create_project(org_id: str, body: NameInput, tasks: BackgroundTasks):
        project = service.create_project(org_id, body.name)
        if store.api_key():
            hapic = store.one("SELECT id FROM agents WHERE project_id=? AND kind='hapic'", (project["id"],))
            tasks.add_task(service.provision, hapic["id"])
        return project

    @app.get("/api/templates/ux")
    def ux_template():
        return {**json.loads((ROOT / "templates/ux/template.json").read_text(encoding="utf-8")), "instructions": (ROOT / "templates/ux/SOUL.md").read_text(encoding="utf-8")}

    @app.post("/api/projects/{project_id}/agents", status_code=201)
    def create_agent(project_id: str, body: NameInput, tasks: BackgroundTasks):
        agent = service.create_agent(project_id, body.name)
        tasks.add_task(service.provision, agent["id"])
        return agent

    @app.post("/api/agents/{agent_id}/start", status_code=202)
    def start_agent(agent_id: str, tasks: BackgroundTasks):
        service.agent(agent_id)
        tasks.add_task(service.provision, agent_id)
        return {"queued": True}

    @app.get("/api/agents/{agent_id}/runtime")
    def agent_runtime(agent_id: str):
        return service.runtime.inspect(service.agent(agent_id), store)

    @app.get("/api/agents/{agent_id}/messages")
    def messages(agent_id: str):
        service.agent(agent_id)
        return store.all("SELECT * FROM messages WHERE agent_id=? ORDER BY id", (agent_id,))

    @app.get("/api/agents/{agent_id}/events")
    def events(agent_id: str):
        service.agent(agent_id)
        return store.all("SELECT * FROM events WHERE agent_id=? ORDER BY id DESC LIMIT 100", (agent_id,))

    @app.post("/api/agents/{agent_id}/chat")
    async def chat(agent_id: str, body: ChatInput):
        agent = service.agent(agent_id)
        if re.search(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}", body.content):
            raise ValueError("No pegues API keys en el chat. Usa el formulario seguro de Configuración.")
        if not store.api_key():
            raise RuntimeUnavailable("Configura la API key en Configuración para conversar con Hermes.")
        if not agent.get("container_id"):
            raise RuntimeUnavailable("Inicia el contenedor del agente antes de conversar.")
        lock = service.lock(agent_id)
        if not lock.acquire(blocking=False):
            raise HTTPException(409, "Hay un turno o una provisión en curso. Espera a que termine.")
        try:
            previous = store.setting("reply-" + body.request_id)
            if previous:
                if previous["agent_id"] != agent_id or previous["input"] != body.content:
                    raise HTTPException(409, "El identificador ya pertenece a otro turno.")
                return previous["result"]
            # Store input once; Hermes Idempotency-Key prevents duplicate side effects on retry.
            prior_input = store.setting("input-" + body.request_id)
            identity = {"agent_id": agent_id, "content": body.content}
            if prior_input and prior_input != identity:
                raise HTTPException(409, "El identificador ya pertenece a otro turno.")
            if not prior_input:
                store.message(agent_id, "user", body.content, "user")
                store.set_setting("input-" + body.request_id, identity)
            answer, status = await service.runtime.chat(agent, store, body.content, body.request_id)
            store.message(agent_id, "assistant", answer)
            result = {"content": answer, "status": status}
            store.set_setting("reply-" + body.request_id, {"agent_id": agent_id, "input": body.content, "result": result})
            return result
        except RuntimeUnavailable as exc:
            store.event(agent_id, str(exc))
            raise
        finally:
            lock.release()

    @app.get("/api/projects/{project_id}/tree")
    def tree(project_id: str):
        return service.tree(project_id)

    @app.get("/api/projects/{project_id}/file")
    def read_file(project_id: str, path: str):
        project = service.project(project_id)
        file = safe_path(store.project_path(project), path)
        return {"path": path, "content": file.read_text(encoding="utf-8"), "size": file.stat().st_size}

    @app.put("/api/settings/model")
    def model_settings(body: ModelInput):
        if body.effort not in EFFORTS:
            raise ValueError("Selecciona low, medium, high, xhigh o max.")
        store.set_setting("model", body.model_dump())
        return body

    @app.put("/api/agents/{agent_id}/model")
    def agent_model(agent_id: str, body: ModelInput):
        agent = service.agent(agent_id)
        if body.effort not in EFFORTS:
            raise ValueError("Nivel de razonamiento no válido.")
        if not service.lock(agent_id).acquire(blocking=False):
            raise HTTPException(409, "Espera a que termine el turno o la provisión.")
        try:
            store.execute("UPDATE agents SET model=?,effort=? WHERE id=?", (body.model, body.effort, agent_id))
            service.runtime.prepare({**agent, **body.model_dump()}, store)
            store.event(agent_id, "Modelo y razonamiento actualizados para el siguiente turno.")
            return service.agent(agent_id)
        finally:
            service.lock(agent_id).release()

    @app.put("/api/settings/openai")
    def save_key(body: KeyInput):
        if os.getenv("OPENAI_API_KEY"):
            raise ValueError("La credencial está definida en el entorno del servidor. Actualízala allí.")
        if not body.api_key.startswith("sk-") or any(c.isspace() for c in body.api_key):
            raise ValueError("La API key no tiene un formato válido.")
        store.secret("openai", body.api_key)
        return {"configured": True, "message": "Credencial guardada en el servidor. Reinicia los agentes para aplicar una rotación."}

    @app.delete("/api/settings/openai")
    def delete_key():
        path = store.secrets_dir / "openai.enc"
        path.unlink(missing_ok=True)
        return {"configured": bool(os.getenv("OPENAI_API_KEY"))}

    app.mount("/mcp", mcp.streamable_http_app())
    dist = ROOT / "frontend/dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        def spa(path: str):
            if path.startswith(("api/", "mcp/")):
                raise HTTPException(404)
            return FileResponse(dist / "index.html")
    return app


app = create_app()
