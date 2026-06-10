#!/usr/bin/env bash
set -euo pipefail

# Genera TaskFlow.desktop con la ruta real del repo y lo instala
# en el menú de aplicaciones del usuario.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

mkdir -p "$APPS_DIR"
sed "s|__TASKFLOW_DIR__|$REPO_DIR|g" "$REPO_DIR/TaskFlow.desktop.example" \
  > "$APPS_DIR/TaskFlow.desktop"

echo "Lanzador instalado en $APPS_DIR/TaskFlow.desktop"
