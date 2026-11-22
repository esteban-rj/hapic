"""Model selection for automatic agent turns, without a separate API request."""
import re

from .storage import DEFAULT_MODEL
from .litellm import base_url

AUTOMATIC_MODEL = "auto"


def model_settings(store):
    return store.setting("model", {"model": AUTOMATIC_MODEL if base_url() else DEFAULT_MODEL, "effort": "xhigh"})


COMPLEX_WORK = re.compile(
    r"\b(?:arquitectura|architectur\w*|refactor\w*|migra(?:r|ci[oó]n|ciones)?|migrat\w*|"
    r"concurren\w*|race conditions?|regresi(?:[oó]n|ones)|regressions?|causa ra[ií]z|root cause|"
    r"depur\w*|debug\w*|diagn[oó]stic\w*|diagnostic\w*|audit\w*)\b",
    re.IGNORECASE,
)
GREETING = re.compile(r"[¡!¿?.,\s]*(?:hola|hello|hi|gracias|thanks|thank you)[¡!¿?.,\s]*", re.IGNORECASE)
SIMPLE_WORK = re.compile(
    r"^\s*(?:traduce|translate|resume|summarize|corrige la ortograf[ií]a|fix (?:the )?spelling)\b",
    re.IGNORECASE,
)


def resolve_turn_model(agent, task="", *, gateway_model=None):
    """Return a copy with a concrete model for automatic mode, or the manual settings."""
    if agent["model"] != AUTOMATIC_MODEL:
        return agent
    if gateway_model:
        return {**agent, "model": gateway_model}
    task = task.strip()
    if len(task) >= 1200 or COMPLEX_WORK.search(task):
        return {**agent, "model": "gpt-6-astra", "effort": "xhigh"}
    if GREETING.fullmatch(task) or (len(task) <= 280 and SIMPLE_WORK.match(task)):
        return {**agent, "model": "gpt-6-luna", "effort": "low"}
    return {**agent, "model": DEFAULT_MODEL, "effort": "high"}
