const { Tray, Menu, app, nativeImage } = require("electron");
const path = require("path");
const {
  ATAJO_QUICKADD,
  showMainWindow,
  showQuickAdd,
  marcarQueSeSale,
} = require("./windows");

const ICONO = path.join(__dirname, "../assets/tray-icon.png");

// Se guarda en una variable de módulo porque un Tray sin referencia viva puede
// ser recolectado y desaparecer de la bandeja.
let tray = null;

function createTray() {
  const icono = nativeImage
    .createFromPath(ICONO)
    .resize({ width: 16, height: 16 });

  tray = new Tray(icono);
  tray.setToolTip("TaskFlow");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir TaskFlow", click: showMainWindow },
      {
        label: "Agregar tarea rápida",
        accelerator: ATAJO_QUICKADD,
        click: showQuickAdd,
      },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          marcarQueSeSale();
          app.quit();
        },
      },
    ]),
  );

  tray.on("double-click", showMainWindow);
  return tray;
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

module.exports = { createTray, destroyTray };
