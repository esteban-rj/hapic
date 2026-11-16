"""Persistent provisioning milestones. Only platform-owned, secret-free logs are recorded."""
import json
from datetime import datetime

from .i18n import tr
from .storage import now


STEPS = (
    ("profile", "Perfil y memoria", "Crear el perfil, la memoria inicial y el workspace independiente."),
    ("requirements", "Requisitos", "Comprobar Docker y la credencial de OpenAI."),
    ("configuration", "Configuración", "Preparar el modelo, las herramientas y los permisos de Hermes."),
    ("network", "Red", "Comprobar o crear la red Docker del proyecto."),
    ("image", "Imagen de Hermes", "Buscar la imagen local y descargarla si hace falta."),
    ("container", "Contenedor", "Crear el contenedor con su perfil y workspace persistentes."),
    ("readiness", "API disponible", "Esperar la respuesta autenticada de salud de Hermes."),
)
INTERRUPTED = "La plataforma se reinició durante la provisión. Comprueba el runtime y reintenta."
FAILED = "Esta etapa falló. Comprueba Docker, la imagen y los permisos de los volúmenes antes de reintentar."


class Preparation:
    def __init__(self, store, run_id):
        self.store = store
        self.id = run_id

    @classmethod
    def create(cls, store, agent_id, *, reuse_profile=False):
        with store.db() as db:
            run_id = db.execute("INSERT INTO agent_preparations(agent_id,status,created_at) VALUES (?,'pending',?)", (agent_id, now())).lastrowid
            db.executemany("INSERT INTO preparation_steps(preparation_id,name,status) VALUES (?,?,'pending')", [(run_id, name) for name, _, _ in STEPS])
        result = cls(store, run_id)
        if reuse_profile:
            result.start("profile", "Se reutilizan el perfil, la memoria y el workspace existentes.")
            result.complete("profile")
        return result

    @classmethod
    def current(cls, store, agent_id):
        row = store.one("SELECT * FROM agent_preparations WHERE agent_id=? ORDER BY id DESC LIMIT 1", (agent_id,))
        return cls(store, row["id"]) if row else None

    @classmethod
    def begin(cls, store, agent_id):
        current = cls.current(store, agent_id)
        if not current or store.one("SELECT status FROM agent_preparations WHERE id=?", (current.id,))["status"] in {"completed", "blocked", "failed"}:
            agent = store.one("SELECT * FROM agents WHERE id=?", (agent_id,))
            base = store.agent_path(agent)
            profile_exists = (base / "hermes/SOUL.md").is_file() and (base / "hermes/memories").is_dir() and (base / "workspace").is_dir()
            current = cls.create(store, agent_id, reuse_profile=profile_exists)
        store.execute("UPDATE agent_preparations SET status='running' WHERE id=?", (current.id,))
        return current

    def log(self, name, message):
        # Never persist exception text, container stdout, environment or provider responses here.
        with self.store.db() as db:
            row = db.execute("SELECT logs FROM preparation_steps WHERE preparation_id=? AND name=?", (self.id, name)).fetchone()
            logs = json.loads(row["logs"])
            logs.append({"created_at": now(), "message": message})
            db.execute("UPDATE preparation_steps SET logs=? WHERE preparation_id=? AND name=?", (json.dumps(logs, ensure_ascii=False), self.id, name))

    def start(self, name, message):
        self.store.execute("UPDATE agent_preparations SET status='running' WHERE id=?", (self.id,))
        self.store.execute("UPDATE preparation_steps SET status='running',started_at=?,finished_at=NULL WHERE preparation_id=? AND name=?", (now(), self.id, name))
        self.log(name, message)

    def complete(self, name, message=None):
        if message:
            self.log(name, message)
        self.store.execute("UPDATE preparation_steps SET status='completed',finished_at=? WHERE preparation_id=? AND name=?", (now(), self.id, name))

    def finish(self):
        if self.store.one("SELECT 1 FROM preparation_steps WHERE preparation_id=? AND status!='completed' LIMIT 1", (self.id,)):
            raise ValueError("La preparación contiene etapas sin completar.")
        self.store.execute("UPDATE agent_preparations SET status='completed',finished_at=? WHERE id=?", (now(), self.id))

    def fail(self, status, message):
        row = self.store.one("SELECT name FROM preparation_steps WHERE preparation_id=? AND status='running' LIMIT 1", (self.id,))
        if not row:
            row = self.store.one("SELECT name FROM preparation_steps WHERE preparation_id=? AND status='pending' ORDER BY rowid LIMIT 1", (self.id,))
        if row:
            self.log(row["name"], message)
            self.store.execute("UPDATE preparation_steps SET status=?,finished_at=? WHERE preparation_id=? AND name=?", (status, now(), self.id, row["name"]))
        self.store.execute("UPDATE agent_preparations SET status=?,finished_at=? WHERE id=?", (status, now(), self.id))

    def snapshot(self):
        run = self.store.one("SELECT * FROM agent_preparations WHERE id=?", (self.id,))
        rows = {row["name"]: row for row in self.store.all("SELECT * FROM preparation_steps WHERE preparation_id=?", (self.id,))}
        steps = []
        for name, label, description in STEPS:
            row = rows[name]
            end = row["finished_at"] or now()
            duration = max(0, (datetime.fromisoformat(end) - datetime.fromisoformat(row["started_at"])).total_seconds()) if row["started_at"] else None
            steps.append({"id": name, "label": tr(label), "description": tr(description), "status": row["status"],
                          "started_at": row["started_at"], "finished_at": row["finished_at"], "duration_seconds": duration,
                          "logs": [{**item, "message": tr(item["message"])} for item in json.loads(row["logs"])]})
        return {"id": self.id, "status": run["status"], "created_at": run["created_at"], "finished_at": run["finished_at"],
                "steps": steps, "completed": sum(step["status"] == "completed" for step in steps), "total": len(steps)}


def interrupt_preparations(store):
    for run in store.all("SELECT id FROM agent_preparations WHERE status='running'"):
        Preparation(store, run["id"]).fail("blocked", INTERRUPTED)
