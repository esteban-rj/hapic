from __future__ import annotations

import json
import re
import shutil
import sqlite3
import threading
from pathlib import Path

from .runtime import DockerRuntime, RuntimeUnavailable
from .storage import ROOT, DEFAULT_MODEL, Store, now, uid

SAFE_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml", ".csv", ".html", ".css", ".svg"}
HIDDEN_NAMES = {"secrets", ".env", "auth.json", "logs", "cache", "installs", ".git", "node_modules", "mcp-tokens"}


def valid_name(value):
    value = value.strip()
    if not 1 <= len(value) <= 80 or any(ord(c) < 32 for c in value) or any(c in value for c in "/\\"):
        raise ValueError("Usa un nombre de 1 a 80 caracteres, sin rutas ni caracteres de control.")
    return value


def safe_path(root: Path, relative: str, *, writing=False):
    if not relative or "\\" in relative or ":" in relative:
        raise ValueError("Ruta no permitida.")
    parts = Path(relative).parts
    if any(p in {"..", "."} or p.startswith(".") or p in HIDDEN_NAMES for p in parts):
        raise ValueError("Ruta no permitida.")
    current = root
    for part in parts:
        current = current / part
        if current.is_symlink() or (current.exists() and getattr(current, "is_junction", lambda: False)()):
            raise ValueError("No se permite acceder a enlaces ni uniones de carpetas.")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("La ruta está fuera del proyecto autorizado.")
    if path.suffix.lower() not in SAFE_EXTENSIONS or path.name.startswith("auth") or path.name in {"config.yaml", "config.yml"}:
        raise ValueError("Este tipo de archivo no admite vista previa ni edición.")
    if not writing and (not path.is_file() or path.stat().st_size > 256_000):
        raise ValueError("Archivo inexistente o demasiado grande (máximo 256 KB).")
    return path


class Service:
    def __init__(self, store: Store, runtime=None):
        self.store = store
        self.runtime = runtime or DockerRuntime()
        self.locks = {}
        self.locks_guard = threading.Lock()

    def lock(self, agent_id):
        with self.locks_guard:
            return self.locks.setdefault(agent_id, threading.Lock())

    def project(self, project_id, user="local-owner"):
        result = self.store.one("SELECT p.* FROM projects p JOIN memberships m ON m.organization_id=p.organization_id WHERE p.id=? AND m.user_id=?", (project_id, user))
        if not result:
            raise LookupError("Proyecto no encontrado o sin permiso.")
        return result

    def agent(self, agent_id):
        result = self.store.one("SELECT * FROM agents WHERE id=?", (agent_id,))
        if not result:
            raise LookupError("Agente no encontrado.")
        self.project(result["project_id"])
        return result

    def create_org(self, name):
        org = {"id": uid("org"), "name": valid_name(name), "created_at": now()}
        with self.store.db() as db:
            db.execute("INSERT INTO organizations VALUES (:id,:name,:created_at)", org)
            db.execute("INSERT INTO memberships VALUES ('local-owner',?,'owner')", (org["id"],))
        path = self.store.root / "organizations" / org["id"]
        (path / "projects").mkdir(parents=True)
        (path / "organization.json").write_text(json.dumps(org, ensure_ascii=False, indent=2), encoding="utf-8")
        return org

    def create_project(self, org_id, name):
        if not self.store.one("SELECT 1 FROM memberships WHERE organization_id=? AND user_id='local-owner'", (org_id,)):
            raise LookupError("Organización no encontrada o sin permiso.")
        project = {"id": uid("prj"), "organization_id": org_id, "name": valid_name(name), "created_at": now()}
        self.store.execute("INSERT INTO projects VALUES (:id,:organization_id,:name,:created_at)", project)
        path = self.store.project_path(project)
        (path / "workspace").mkdir(parents=True)
        (path / "project.json").write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
        self.create_agent(project["id"], "Hapic", "hapic")
        return project

    def create_agent(self, project_id, name, kind="ux"):
        project = self.project(project_id)
        name = valid_name(name)
        settings = self.store.setting("model", {"model": DEFAULT_MODEL, "effort": "xhigh"})
        agent = {"id": uid("agt"), "organization_id": project["organization_id"], "project_id": project_id, "name": name, "kind": kind, "template": "ux-v1" if kind == "ux" else "hapic-v1", **settings, "status": "pending", "container_id": None, "error": None, "created_at": now()}
        try:
            self.store.execute("INSERT INTO agents VALUES (:id,:organization_id,:project_id,:name,:kind,:template,:model,:effort,:status,:container_id,:error,:created_at)", agent)
        except sqlite3.IntegrityError:
            raise ValueError("Ya existe un agente con ese nombre en el proyecto.") from None
        home = self.store.agent_path(agent) / "hermes"
        home.mkdir(parents=True)
        template = ROOT / "templates" / kind
        soul = (template / "SOUL.md").read_text(encoding="utf-8")
        if kind == "ux":
            shutil.copytree(template / "skills", home / "skills")
            soul += "\n\n## Método de trabajo incluido\n" + (template / "skills/ux-method/SKILL.md").read_text(encoding="utf-8")
        (home / "SOUL.md").write_text(f"Tu nombre es {name}.\n\n" + soul, encoding="utf-8")
        # Fresh memory only: never copy state.db, USER.md or credentials from another profile.
        (home / "memories").mkdir()
        (home / "memories/MEMORY.md").write_text("# Memoria del agente\n\nSin recuerdos todavía.\n", encoding="utf-8")
        (home / "memories/USER.md").write_text("# Contexto compartido\n\nPendiente de conocer al usuario.\n", encoding="utf-8")
        self.runtime.prepare(agent, self.store)
        self.store.event(agent["id"], "Perfil persistente creado desde una plantilla limpia. Contenedor pendiente de iniciar.")
        return agent

    def provision(self, agent_id):
        if not self.lock(agent_id).acquire(blocking=False):
            return self.agent(agent_id)
        try:
            agent = self.agent(agent_id)
            self.store.execute("UPDATE agents SET status='provisioning',error=NULL WHERE id=?", (agent_id,))
            self.store.event(agent_id, "Comenzando provisión Docker.")
            try:
                result = self.runtime.start(agent, self.store)
                self.store.execute("UPDATE agents SET status=?,container_id=?,error=NULL WHERE id=?", (result["status"], result["container_id"], agent_id))
                self.store.event(agent_id, "API Hermes comprobada. Runtime disponible.")
            except RuntimeUnavailable as exc:
                self.store.execute("UPDATE agents SET status='blocked',error=? WHERE id=?", (str(exc), agent_id))
                self.store.event(agent_id, str(exc))
            except Exception:
                # Provider/Docker exceptions can contain credentials. Never persist their raw text.
                self.store.execute("UPDATE agents SET status='error',error=? WHERE id=?", ("La provisión falló. Comprueba la imagen, los volúmenes y los logs locales de Docker.", agent_id))
                self.store.event(agent_id, "La provisión Docker falló; no se ha marcado el agente como disponible.")
            return self.agent(agent_id)
        finally:
            self.lock(agent_id).release()

    def scope(self, token):
        if not token:
            raise PermissionError("Falta autorización MCP.")
        import secrets
        for agent in self.store.all("SELECT * FROM agents"):
            if secrets.compare_digest(self.store.token(agent["id"], "mcp"), token):
                self.project(agent["project_id"])
                return agent
        raise PermissionError("Autorización MCP inválida.")

    def tool(self, agent, name, args):
        project = self.project(agent["project_id"])
        if name == "get_ux_template" and agent["kind"] == "hapic":
            return json.loads((ROOT / "templates/ux/template.json").read_text(encoding="utf-8"))
        if name == "create_ux_agent" and agent["kind"] == "hapic":
            existing = self.store.one("SELECT * FROM agents WHERE project_id=? AND name=?", (project["id"], valid_name(args["name"])))
            if existing:
                if existing["kind"] != "ux":
                    raise ValueError("Ese nombre ya pertenece al orquestador. Elige otro para el especialista UX.")
                return {"id": existing["id"], "name": existing["name"], "status": existing["status"], "already_exists": True}
            created = self.create_agent(project["id"], args["name"])
            # Queueing is explicit; the agent never claims readiness from a successful enqueue.
            threading.Thread(target=self.provision, args=(created["id"],), daemon=True).start()
            return {"id": created["id"], "name": created["name"], "status": "pending", "message": "Perfil creado. Provisión en cola; consulta el estado real en la plataforma."}
        if agent["kind"] != "ux" or name not in {"project_list_files", "project_read_file", "project_write_file"}:
            raise PermissionError("Herramienta fuera del alcance autorizado.")
        root = self.store.agent_path(agent) / "workspace"
        if name == "project_list_files":
            return {"files": [p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and not p.is_symlink() and not any(x.startswith(".") for x in p.relative_to(root).parts)][:300]}
        path = safe_path(root, args["path"], writing=name == "project_write_file")
        if name == "project_read_file":
            return {"path": args["path"], "content": path.read_text(encoding="utf-8")}
        content = args["content"]
        if len(content.encode()) > 256_000:
            raise ValueError("El documento supera el máximo de 256 KB.")
        if re.search(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}", content):
            raise ValueError("No guardes credenciales en el workspace. Usa Configuración.")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        self.store.event(agent["id"], f"Archivo guardado en el workspace: {args['path']}")
        return {"path": args["path"], "bytes": path.stat().st_size, "saved": True}

    def tree(self, project_id):
        project = self.project(project_id)
        root = self.store.project_path(project)
        count = 0

        def visit(path, depth=0):
            nonlocal count
            count += 1
            relative = path.relative_to(root).as_posix()
            node = {"name": path.name, "path": relative, "type": "directory" if path.is_dir() else "file"}
            if path.is_dir() and depth < 8 and count < 600:
                node["children"] = [visit(p, depth + 1) for p in sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name)) if not p.is_symlink() and not getattr(p, "is_junction", lambda: False)() and not p.name.startswith(".") and p.name not in HIDDEN_NAMES and not p.name.startswith("auth")][:150]
            elif path.is_file():
                node["size"] = path.stat().st_size
                node["preview"] = path.suffix.lower() in SAFE_EXTENSIONS and node["size"] <= 256_000 and path.name not in {"config.yaml", "config.yml"}
            return node
        return visit(root)
