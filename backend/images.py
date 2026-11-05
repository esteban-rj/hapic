"""Generate directly into durable storage; never depend on expiring image URLs."""
import base64
import binascii
import os
import tempfile
from pathlib import Path

import httpx

from .runtime import RuntimeUnavailable

IMAGE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024
DEFAULT_IMAGE_MODEL = "gpt-image-2.5-flare"


def image_type(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:6] in {b"GIF87a", b"GIF89a"}:
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    raise ValueError("El archivo no contiene una imagen PNG, JPEG, WebP o GIF válida.")


def atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".pending-", delete=False) as file:
            temporary = Path(file.name)
            file.write(data)
            file.flush()
            os.fsync(file.fileno())
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


class ImageGenerator:
    def generate(self, key, prompt, size="1024x1024"):
        if not key:
            raise RuntimeUnavailable("Configura la credencial de OpenAI en Configuración.")
        if not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 12_000:
            raise ValueError("El prompt de imagen debe tener entre 1 y 12000 caracteres.")
        if size not in {"1024x1024", "1536x1024", "1024x1536"}:
            raise ValueError("Tamaño de imagen no válido.")
        try:
            with httpx.Client(timeout=httpx.Timeout(240, connect=10), trust_env=False) as client:
                response = client.post("https://api.openai.com/v1/images/generations", headers={"Authorization": "Bearer " + key}, json={"model": os.getenv("HAPIC_IMAGE_MODEL", DEFAULT_IMAGE_MODEL), "prompt": prompt, "n": 1, "size": size, "quality": "medium", "output_format": "png"})
            if not response.is_success:
                raise RuntimeUnavailable(f"OpenAI Images devolvió HTTP {response.status_code}. Revisa acceso al modelo, saldo y credencial; no se guardó ninguna imagen.")
            encoded = response.json()["data"][0]["b64_json"]
            if not isinstance(encoded, str) or len(encoded) > MAX_IMAGE_BYTES * 4 // 3 + 4:
                raise ValueError("Imagen demasiado grande.")
            data = base64.b64decode(encoded, validate=True)
            if not data or len(data) > MAX_IMAGE_BYTES or image_type(data) != "image/png":
                raise ValueError("Imagen no válida.")
            return data
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, binascii.Error):
            raise RuntimeUnavailable("No se recibió una imagen PNG válida. La solicitud puede haberse facturado; comprueba el proveedor antes de repetirla.") from None
