"""Private LiteLLM gateway connection and a catalog scoped to the Hapic key."""
import hashlib
import os
import re
from urllib.parse import urlsplit

import httpx

MODEL_ID_PATTERN = r"^[a-zA-Z0-9._:/@-]+$"
MODEL_ID = re.compile(MODEL_ID_PATTERN)
HERMES_PROVIDER = "custom:litellm"
CATALOG_ERROR = "No se pudo cargar el catálogo de LiteLLM. Comprueba el gateway y la clave virtual."


def base_url():
    return os.getenv("HAPIC_LITELLM_BASE_URL", "").strip().rstrip("/")


def hermes_base_url():
    return os.getenv("HAPIC_LITELLM_HERMES_BASE_URL", "").strip().rstrip("/") or base_url()


def best_model():
    return os.getenv("HAPIC_LITELLM_BEST_MODEL", "").strip() or "best-model"


def image_model():
    return os.getenv("HAPIC_LITELLM_IMAGE_MODEL") if base_url() else None


def gateway_key(store):
    return store.secret("litellm") or os.getenv("HAPIC_LITELLM_API_KEY")


def inference_key(store):
    return gateway_key(store) if base_url() else store.api_key()


def runtime_signature(store, *, key=None):
    if not base_url():
        return ""
    credential = (gateway_key(store) if key is None else key) or ""
    return hashlib.sha256(f"{hermes_base_url()}\n{credential}".encode()).hexdigest()


def load_models(url, key):
    with httpx.Client(timeout=4, trust_env=False) as client:
        response = client.get(f"{url}/models", headers={"Authorization": f"Bearer {key}"})
        response.raise_for_status()
        rows = response.json()["data"]
        if not isinstance(rows, list):
            raise ValueError("Invalid catalog")
    return sorted({
        row["id"] for row in rows
        if isinstance(row, dict) and isinstance(row.get("id"), str)
        and len(row["id"]) <= 200 and MODEL_ID.fullmatch(row["id"])
        and not any(part in {".", ".."} for part in row["id"].split("/"))
    }, key=str.casefold)


def authorized_models(store):
    image = image_model()
    return [model for model in load_models(base_url(), gateway_key(store)) if model != image]


def capabilities(store):
    if not (url := base_url()):
        return None
    key = gateway_key(store)
    dashboard = os.getenv("HAPIC_LITELLM_DASHBOARD_URL", "").strip() or url.removesuffix("/v1") + "/ui"
    try:
        target = urlsplit(dashboard)
        dashboard = dashboard if target.scheme in {"http", "https"} and target.hostname and not target.username and not target.password else None
    except ValueError:
        dashboard = None
    result = {"configured": bool(key), "dashboard_url": dashboard, "best_model": best_model(), "models": [], "error": None}
    if key:
        try:
            result["models"] = authorized_models(store)
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            result["error"] = CATALOG_ERROR
    return result
