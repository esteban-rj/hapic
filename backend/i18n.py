"""Request-scoped language selection and translations for platform-owned text."""
import json
import re
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

_language = ContextVar("hapic_language", default="es")
ENGLISH = json.loads((Path(__file__).parent / "locales/en.json").read_text(encoding="utf-8"))
SPANISH = {value: key for key, value in ENGLISH.items()}


def resolve_language(header):
    choices = []
    for index, item in enumerate((header or "").split(",")):
        parts = item.strip().lower().split(";")
        code = parts[0].split("-")[0]
        try:
            quality = next((float(part.strip()[2:]) for part in parts[1:] if part.strip().startswith("q=")), 1)
        except ValueError:
            continue
        if code in {"en", "es"} and 0 < quality <= 1:
            choices.append((quality, -index, code))
    return max(choices)[2] if choices else "es"


def get_language():
    return _language.get()


@contextmanager
def language_context(language):
    token = _language.set(resolve_language(language))
    try:
        yield
    finally:
        _language.reset(token)


def _pattern(message):
    parts = re.split(r"(\{\w+\})", message)
    return re.compile("".join(f"(?P<{part[1:-1]}>.+)" if part.startswith("{") else re.escape(part) for part in parts), re.DOTALL)


PATTERNS = sorted(
    [(es, en, _pattern(es), _pattern(en)) for es, en in ENGLISH.items() if re.search(r"\{\w+\}", es)],
    key=lambda entry: len(re.sub(r"\{\w+\}", "", entry[0])), reverse=True,
)


def tr(message, language=None, **values):
    target = resolve_language(language) if language is not None else get_language()
    source = message if message in ENGLISH else SPANISH.get(message, message)
    translated = ENGLISH.get(source, source) if target == "en" else source
    if source == message and message not in ENGLISH:
        for es, en, es_pattern, en_pattern in PATTERNS:
            match = es_pattern.fullmatch(message) or en_pattern.fullmatch(message)
            if match:
                translated = (en if target == "en" else es).format(**match.groupdict())
                break
    return translated.format(**values) if values else translated


def localize_fields(data, *fields):
    """Translate only explicit platform fields, never user names or provider data."""
    return {**data, **{key: tr(data[key]) for key in fields if isinstance(data.get(key), str)}}
