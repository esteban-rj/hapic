"""Versioned specialist catalog and server-enforced tool permissions."""
import json

from .storage import ROOT
from .i18n import get_language

SPECIALISTS = ("ux", "graphic-designer", "architect", "coder", "community-manager")
COLLABORATION_TOOLS = ["list_project_agents", "delegate_task", "get_task_status"]
FILE_TOOLS = ["project_list_files", "project_read_file", "project_write_file"]


def template_root(kind, language=None):
    if kind not in (*SPECIALISTS, "hapic"):
        raise ValueError("Plantilla no válida.")
    root = ROOT / "templates" / kind
    return root / "locales/en" if (language or get_language()) == "en" else root


def soul(kind, language=None):
    return (template_root(kind, language) / "SOUL.md").read_text(encoding="utf-8")


def template(kind, instructions=False, language=None):
    if kind not in SPECIALISTS:
        raise ValueError("Plantilla no válida.")
    result = agent_profile(kind, language)
    if instructions:
        result["instructions"] = agent_instructions(kind, language)
    return result


def agent_profile(kind, language=None):
    """Load public role metadata for specialists and the project coordinator."""
    if kind not in (*SPECIALISTS, "hapic"):
        raise ValueError("Plantilla no válida.")
    root = ROOT / "templates" / kind
    result = {**json.loads((root / "template.json").read_text(encoding="utf-8")), "kind": kind, "tools": tools_for(kind)}
    localized = template_root(kind, language)
    if localized != root and (localized / "template.json").exists():
        result.update(json.loads((localized / "template.json").read_text(encoding="utf-8")))
    return result


def agent_instructions(kind, language=None):
    """Use the same current contract and handoff rules for new and existing agents."""
    profile = agent_profile(kind, language)
    role = soul(kind, language)
    collaboration = (ROOT / "templates" / "delegation.md").read_text(encoding="utf-8")
    return role + "\n\n" + collaboration + "\n\n## Tu contrato de delegación\n" + json.dumps(profile["delegation_contract"], ensure_ascii=False)


def tools_for(kind):
    if kind == "hapic":
        return COLLABORATION_TOOLS + ["get_ux_template", "create_ux_agent", "list_agent_templates", "create_specialist_agent"]
    if kind not in SPECIALISTS:
        return []
    extra = {"ux": ["generate_project_image"], "graphic-designer": ["generate_project_image"], "architect": ["publish_architecture_plan"], "coder": ["get_architecture_plan"], "community-manager": []}
    return COLLABORATION_TOOLS + FILE_TOOLS + extra[kind]


def project_roster(store, project_id):
    """Read live metadata only; never expose another agent's private memory or tools."""
    roster = []
    for agent in store.all("SELECT id,name,kind,planner_id,status FROM agents WHERE project_id=? ORDER BY created_at,id", (project_id,)):
        profile = agent_profile(agent["kind"])
        roster.append({**agent, **{key: profile[key] for key in ("role", "description", "capabilities", "deliverables", "delegation_contract")}})
    return roster
