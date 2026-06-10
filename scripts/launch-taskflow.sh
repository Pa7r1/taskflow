#!/usr/bin/env bash
set -euo pipefail

# Carpeta del repo = carpeta padre de este script (sin rutas fijas)
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Variables locales opcionales (.env no se versiona)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export TASKFLOW_RENDERER_PORT="${TASKFLOW_RENDERER_PORT:-42879}"
exec npm start
