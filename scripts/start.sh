#!/bin/sh
set -eu

# Run the primary checkout: managed worktrees can disappear while a server is alive.
script_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
git_dir=$(git -C "$script_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)
if [ -n "$git_dir" ] && [ "$(basename -- "$git_dir")" = .git ]; then
    app_root=$(dirname -- "$git_dir")
else
    app_root=$script_root
fi
cd "$app_root"

port=${1:-8000}
case "$port" in
    ''|*[!0-9]*) echo 'Uso: scripts/start.sh [puerto]' >&2; exit 1 ;;
esac
if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    echo 'El puerto debe estar entre 1 y 65535.' >&2
    exit 1
fi

python=${HAPIC_PYTHON:-$app_root/.venv/bin/python}
if [ ! -x "$python" ]; then
    echo "Crea un entorno Python en $app_root/.venv e instala requirements.lock antes de iniciar Hapic." >&2
    exit 1
fi
if [ ! -f frontend/dist/index.html ]; then
    echo "Compila la interfaz en $app_root/frontend con pnpm install --frozen-lockfile y pnpm build." >&2
    exit 1
fi

HAPIC_DATA_DIR=${HAPIC_DATA_DIR:-$app_root/.hapic}
HAPIC_DATA_DIR=$("$python" -c 'import pathlib, sys; print(pathlib.Path(sys.argv[1]).expanduser().resolve())' "$HAPIC_DATA_DIR")
HAPIC_HOST_DATA_DIR=${HAPIC_HOST_DATA_DIR:-$HAPIC_DATA_DIR}
export HAPIC_DATA_DIR HAPIC_HOST_DATA_DIR
# docker-py uses DOCKER_HOST, whereas the CLI also understands Docker contexts.
if [ -z "${DOCKER_HOST:-}" ] && command -v docker >/dev/null 2>&1; then
    DOCKER_HOST=$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)
    if [ -n "$DOCKER_HOST" ]; then export DOCKER_HOST; fi
fi

printf 'Hapic: http://127.0.0.1:%s\nCódigo: %s\nDatos: %s\n' "$port" "$app_root" "$HAPIC_DATA_DIR"
if [ -f .env ]; then
    exec "$python" -m uvicorn backend.app:app --host 127.0.0.1 --port "$port" --env-file .env
fi
exec "$python" -m uvicorn backend.app:app --host 127.0.0.1 --port "$port"
