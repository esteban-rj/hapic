"""Versioned specialist catalog and server-enforced tool permissions."""
import json

from .storage import ROOT
from .i18n import get_language

SPECIALISTS = ("ux", "graphic-designer", "architect", "coder", "community-manager")
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
    root = ROOT / "templates" / kind
    result = {**json.loads((root / "template.json").read_text(encoding="utf-8")), "kind": kind, "tools": tools_for(kind)}
    localized = template_root(kind, language)
    if localized != root:
        result.update(json.loads((localized / "template.json").read_text(encoding="utf-8")))
    if instructions:
        result["instructions"] = soul(kind, language)
    return result


def tools_for(kind):
    if kind == "hapic":
        return ["get_ux_template", "create_ux_agent", "list_agent_templates", "list_project_agents", "create_specialist_agent"]
    if kind not in SPECIALISTS:
        return []
    extra = {"ux": ["generate_project_image"], "graphic-designer": ["generate_project_image"], "architect": ["publish_architecture_plan"], "coder": ["get_architecture_plan"], "community-manager": []}
    return FILE_TOOLS + extra[kind]
