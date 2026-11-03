"""Record the installed environment, including the Windows-only Docker transport marker."""
import importlib.metadata
from pathlib import Path

packages = sorted((d.metadata["Name"], d.version) for d in importlib.metadata.distributions())
lines = ["# Resolved on Python 3.14; update deliberately after compatibility checks."]
for name, version in packages:
    marker = '; sys_platform == "win32"' if name.lower() == "pywin32" else ""
    lines.append(f"{name}=={version}{marker}")
Path(__file__).resolve().parent.parent.joinpath("requirements.lock").write_text("\n".join(lines) + "\n", encoding="utf-8")
