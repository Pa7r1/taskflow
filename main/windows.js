const { app, BrowserWindow, Notification, screen } = require("electron");
const path = require("path");

const ATAJO_QUICKADD = "CmdOrCtrl+Shift+Space";
const QUICKADD_WIDTH = 520;
const QUICKADD_COMPACT_HEIGHT = 120;
const QUICKADD_MAX_HEIGHT = 600;

// `app.isPackaged` y no NODE_ENV: en la app empaquetada NODE_ENV no está
// definido, así que la comprobación anterior daba isDev = true y el binario
// distribuido intentaba cargar el servidor de Vite (ERR_CONNECTION_REFUSED).
// TASKFLOW_FORCE_DEV permite forzar el modo desarrollo si alguna vez hace falta.
const isDev = !app.isPackaged || process.env.TASKFLOW_FORCE_DEV === "1";
const RENDERER_PORT = process.env.TASKFLOW_RENDERER_PORT || "42879";
const RENDERER_URL = `http://127.0.0.1:${RENDERER_PORT}`;
const RENDERER_BUILD = path.join(__dirname, "../renderer/dist/index.html");
const PRELOAD = path.join(__dirname, "../preload.js");

const webPreferences = {
  preload: PRELOAD,
  contextIsolation: true,
  nodeIntegration: false,
};

let mainWindow = null;
let quickAddWindow = null;

// La X de la ventana solo la oculta: la app sigue viva en la bandeja para que el
// atajo global y los recordatorios sigan funcionando. Solo "Salir" del tray (o
// un app.quit()) cierra de verdad, y esta bandera es cómo se distingue.
let saliendoDeVerdad = false;

function marcarQueSeSale() {
  saliendoDeVerdad = true;
}

// ─── Ventana principal ─────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#0f0f13",
    webPreferences,
    show: false,
  });

  isDev
    ? mainWindow.loadURL(RENDERER_URL)
    : mainWindow.loadFile(RENDERER_BUILD);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("close", (evento) => {
    if (saliendoDeVerdad) return;
    evento.preventDefault();
    mainWindow.hide();
    avisarDeLaBandejaUnaVez();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function showMainWindow() {
  if (!mainWindow) return createMainWindow();
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

// La primera vez que se esconde, avisa: si no, parece que la app se cerró y
// sigue ocupando memoria sin que se entienda por qué.
let yaAvisadoDeLaBandeja = false;
function avisarDeLaBandejaUnaVez() {
  if (yaAvisadoDeLaBandeja || !Notification.isSupported()) return;
  yaAvisadoDeLaBandeja = true;
  new Notification({
    title: "TaskFlow sigue en la bandeja",
    body: `Tus recordatorios siguen activos. ${ATAJO_QUICKADD} para capturar algo; "Salir" en el menú de la bandeja para cerrar del todo.`,
  }).show();
}

// ─── Popup de captura rápida ───────────────────────────────────────────────

function createQuickAddWindow() {
  quickAddWindow = new BrowserWindow({
    width: QUICKADD_WIDTH,
    height: QUICKADD_COMPACT_HEIGHT,
    frame: false,
    alwaysOnTop: true,
    // resizable para que setContentSize funcione en Linux; sin marco no hay manijas
    resizable: true,
    skipTaskbar: true,
    backgroundColor: "#1a1a2e",
    webPreferences,
    show: false,
  });

  isDev
    ? quickAddWindow.loadURL(`${RENDERER_URL}?mode=quickadd`)
    : quickAddWindow.loadFile(RENDERER_BUILD, { query: { mode: "quickadd" } });

  quickAddWindow.on("blur", () => quickAddWindow.hide());
  quickAddWindow.on("hide", () =>
    quickAddWindow.setContentSize(QUICKADD_WIDTH, QUICKADD_COMPACT_HEIGHT),
  );
  quickAddWindow.on("closed", () => {
    quickAddWindow = null;
  });

  return quickAddWindow;
}

function showQuickAdd() {
  if (!quickAddWindow) createQuickAddWindow();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  quickAddWindow.setPosition(
    Math.floor(width / 2 - QUICKADD_WIDTH / 2),
    Math.floor(height * 0.3),
  );
  quickAddWindow.show();
  quickAddWindow.focus();
  quickAddWindow.webContents.send("focus:quickadd");
}

function hideQuickAdd() {
  quickAddWindow?.hide();
}

function resizeQuickAdd(alto) {
  quickAddWindow?.setContentSize(
    QUICKADD_WIDTH,
    Math.max(
      QUICKADD_COMPACT_HEIGHT,
      Math.min(QUICKADD_MAX_HEIGHT, Math.round(alto)),
    ),
  );
}

// ─── Difusión de cambios ───────────────────────────────────────────────────

// Toda mutación se anuncia a todas las ventanas. Es el único camino por el que
// el renderer recarga datos: si además recargara por su cuenta tras mutar,
// cada acción costaría dos consultas.
function broadcastDataChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("data:changed");
  }
}

module.exports = {
  ATAJO_QUICKADD,
  createMainWindow,
  showMainWindow,
  getMainWindow,
  showQuickAdd,
  hideQuickAdd,
  resizeQuickAdd,
  broadcastDataChanged,
  marcarQueSeSale,
};
