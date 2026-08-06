#!/usr/bin/env bash
set -euo pipefail

# Instala TaskFlow en el menú de aplicaciones del usuario.
#
#   ./scripts/install-desktop.sh          instala la app empaquetada (uso diario)
#   ./scripts/install-desktop.sh --dev    instala un lanzador de desarrollo
#
# La diferencia importa: el lanzador de desarrollo levanta el servidor de Vite,
# su watcher y Electron apuntando a localhost, y eso ronda 1,4 GB de memoria.
# El AppImage se queda en torno a 270 MB. Para el día a día, el empaquetado.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/taskflow"
PLANTILLA="$REPO_DIR/TaskFlow.desktop.example"

if [[ "${1:-}" == "--dev" ]]; then
  NOMBRE="TaskFlow (desarrollo)"
  EJECUTABLE="$REPO_DIR/scripts/launch-taskflow.sh"
  DESTINO="$APPS_DIR/TaskFlow-dev.desktop"
else
  # El AppImage más reciente de dist/
  APPIMAGE="$(ls -t "$REPO_DIR"/dist/TaskFlow-*.AppImage 2>/dev/null | head -1 || true)"
  if [[ -z "$APPIMAGE" ]]; then
    echo "No hay ningún AppImage en dist/." >&2
    echo "Empaquétalo primero con:  pnpm run build" >&2
    exit 1
  fi

  # Se copia fuera del repo: así el lanzador no depende de dist/, que se
  # reescribe en cada build, ni de que el repo siga en la misma ruta.
  mkdir -p "$INSTALL_DIR"
  install -m 755 "$APPIMAGE" "$INSTALL_DIR/TaskFlow.AppImage"

  NOMBRE="TaskFlow"
  # `env -u ELECTRON_RUN_AS_NODE`: si esa variable está en el entorno (la exporta
  # la terminal integrada de VS Code), el binario de Electron arranca como Node
  # plano y la app se cierra sola sin decir nada.
  EJECUTABLE="env -u ELECTRON_RUN_AS_NODE $INSTALL_DIR/TaskFlow.AppImage"
  DESTINO="$APPS_DIR/TaskFlow.desktop"
  echo "App instalada en $INSTALL_DIR/TaskFlow.AppImage ($(du -h "$APPIMAGE" | cut -f1))"
fi

ICONO="$REPO_DIR/assets/icon.png"

mkdir -p "$APPS_DIR"
sed -e "s|__TASKFLOW_NAME__|$NOMBRE|g" \
    -e "s|__TASKFLOW_EXEC__|$EJECUTABLE|g" \
    -e "s|__TASKFLOW_DIR__|$REPO_DIR|g" \
    -e "s|__TASKFLOW_ICON__|$ICONO|g" \
    "$PLANTILLA" > "$DESTINO"

# Que el menú lo vea sin cerrar sesión.
command -v update-desktop-database >/dev/null && \
  update-desktop-database "$APPS_DIR" 2>/dev/null || true

echo "Lanzador «$NOMBRE» instalado en $DESTINO"
