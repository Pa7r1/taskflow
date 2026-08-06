// Punto de entrada del proceso main. Solo arranca y orquesta; el trabajo vive
// en los módulos de al lado:
//
//   windows.js    — ventanas, su ciclo de vida y la difusión de cambios
//   tray.js       — bandeja del sistema y su menú
//   reminders.js  — programación de notificaciones
//   ipc.js        — todos los handlers del puente con el renderer
//   db/           — única puerta a SQLite

const {
  app,
  BrowserWindow,
  globalShortcut,
  powerMonitor,
} = require("electron");
const db = require("./db");
const recordatorios = require("./reminders");
const { registrarHandlers } = require("./ipc");
const { createTray, destroyTray } = require("./tray");
const {
  ATAJO_QUICKADD,
  createMainWindow,
  showQuickAdd,
  marcarQueSeSale,
} = require("./windows");

app.whenReady().then(() => {
  registrarHandlers();
  createMainWindow();
  createTray();

  globalShortcut.register(ATAJO_QUICKADD, showQuickAdd);

  recordatorios.restaurar();
  recordatorios.programarResumenDiario();

  // Al despertar de una suspensión los temporizadores llevan retraso: se
  // reconstruyen todos contra el reloj real.
  powerMonitor.on("resume", () => {
    recordatorios.restaurar();
    recordatorios.programarResumenDiario();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// La app no muere al cerrar la última ventana: vive en la bandeja hasta que se
// pulse "Salir". En macOS ese ya era el comportamiento esperado.
app.on("window-all-closed", () => {});

app.on("before-quit", marcarQueSeSale);

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  recordatorios.cancelarTodos();
  destroyTray();
  db.close();
});
