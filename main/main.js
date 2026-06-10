const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  globalShortcut,
  Notification,
  nativeImage,
} = require("electron");
const path = require("path");
const db = require("./db");

let mainWindow, quickAddWindow, tray;
const isDev = process.env.NODE_ENV !== "production";
const RENDERER_PORT = process.env.TASKFLOW_RENDERER_PORT || "42879";
const RENDERER_URL = `http://127.0.0.1:${RENDERER_PORT}`;
const RENDERER_BUILD = path.join(__dirname, "../renderer/dist/index.html");

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#0f0f13",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  isDev
    ? mainWindow.loadURL(RENDERER_URL)
    : mainWindow.loadFile(RENDERER_BUILD);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const QUICKADD_WIDTH = 520;
const QUICKADD_COMPACT_HEIGHT = 120;

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
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const url = isDev
    ? RENDERER_URL + "?mode=quickadd"
    : RENDERER_BUILD + "?mode=quickadd";
  isDev
    ? quickAddWindow.loadURL(url)
    : quickAddWindow.loadFile(RENDERER_BUILD, { query: { mode: "quickadd" } });

  quickAddWindow.on("blur", () => quickAddWindow.hide());
  quickAddWindow.on("hide", () =>
    quickAddWindow.setContentSize(QUICKADD_WIDTH, QUICKADD_COMPACT_HEIGHT),
  );
  quickAddWindow.on("closed", () => {
    quickAddWindow = null;
  });
}

function createTray() {
  // Icono simple en base64 (círculo azul)
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI5SURBVFiF7ZdNaxNBGMd/s9kkm2STbJKmqUlqKkVaFDz4hr0IHjx58ODBgycPnrx48ODBm4c8gCBeRPAgeBAEQRAEQRAEL6IgCIIgCIIgCIIgCIIgCIIgCIIgCIIQ8n+SNptkk2ySJEnSJEmSJH3fd3RVVdWu67qu67quAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOM+Y8xxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wx5j/GGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDH/Y4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wx5j/GGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wx5j/GGGOMMcYYY4wx5j/GGGNM+A1xXAAAAABJRU5ErkJggg==",
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("TaskFlow");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Abrir TaskFlow",
        click: () => {
          mainWindow ? mainWindow.show() : createMainWindow();
        },
      },
      {
        label: "Agregar tarea rápida",
        accelerator: "CmdOrCtrl+Space",
        click: () => showQuickAdd(),
      },
      { type: "separator" },
      { label: "Salir", click: () => app.quit() },
    ]),
  );

  tray.on("double-click", () => {
    mainWindow ? mainWindow.focus() : createMainWindow();
  });
}

function showQuickAdd() {
  if (!quickAddWindow) createQuickAddWindow();
  const { width, height } =
    require("electron").screen.getPrimaryDisplay().workAreaSize;
  quickAddWindow.setPosition(
    Math.floor(width / 2 - 260),
    Math.floor(height * 0.3),
  );
  quickAddWindow.show();
  quickAddWindow.focus();
  quickAddWindow.webContents.send("focus:quickadd");
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
}

// Recordatorios programados en memoria, indexados por tarea para poder
// reprogramarlos o cancelarlos (al completar/eliminar la tarea).
const reminderTimeouts = new Map();

function cancelReminder(taskId) {
  const timeout = reminderTimeouts.get(taskId);
  if (timeout) {
    clearTimeout(timeout);
    reminderTimeouts.delete(taskId);
  }
}

function scheduleNotification(taskId, time) {
  cancelReminder(taskId);
  if (!db.getTaskById(taskId)) return;
  const delay = new Date(time).getTime() - Date.now();
  if (isNaN(delay) || delay <= 0) return;

  reminderTimeouts.set(
    taskId,
    setTimeout(() => {
      reminderTimeouts.delete(taskId);
      // Releer la tarea: pudo cambiar de título o completarse mientras esperaba
      const task = db.getTaskById(taskId);
      if (!task || task.completed) return;
      const notification = new Notification({
        title: "⏰ TaskFlow — Recordatorio",
        body: task.title,
        urgency: "normal",
      });
      notification.on("click", showMainWindow);
      notification.show();
    }, delay),
  );
}

// Al arrancar, reprograma los recordatorios guardados en la base — los
// setTimeout no sobreviven reinicios de la app.
function restoreReminders() {
  for (const task of db.getPendingReminders()) {
    scheduleNotification(task.id, task.reminder_at);
  }
}

// Avisa a todas las ventanas que los datos cambiaron, para que la ventana
// principal se refresque cuando la mutación vino del popup quick-add (y viceversa).
function broadcastDataChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("data:changed");
  }
}

// IPC handlers
ipcMain.handle("db:getTasks", (_, filter) => db.getTasks(filter));
ipcMain.handle("db:createTask", (_, task) => {
  const created = db.createTask(task);
  if (created.reminder_at) scheduleNotification(created.id, created.reminder_at);
  broadcastDataChanged();
  return created;
});
ipcMain.handle("db:updateTask", (_, id, data) => {
  const updated = db.updateTask(id, data);
  if ("reminder_at" in data) {
    data.reminder_at
      ? scheduleNotification(id, data.reminder_at)
      : cancelReminder(id);
  }
  broadcastDataChanged();
  return updated;
});
ipcMain.handle("db:deleteTask", (_, id) => {
  const result = db.deleteTask(id);
  cancelReminder(id);
  broadcastDataChanged();
  return result;
});
ipcMain.handle("db:toggleTask", (_, id) => {
  const task = db.toggleTask(id);
  if (task?.completed) {
    cancelReminder(id);
  } else if (task?.reminder_at) {
    scheduleNotification(id, task.reminder_at);
  }
  broadcastDataChanged();
  return task;
});
ipcMain.handle("db:getCategories", () => db.getCategories());
ipcMain.handle("db:createCategory", (_, name, color) => {
  const created = db.createCategory(name, color);
  broadcastDataChanged();
  return created;
});
ipcMain.handle("notify:schedule", (_, taskId, time) =>
  scheduleNotification(taskId, time),
);
ipcMain.on("window:closeQuickAdd", () => quickAddWindow?.hide());
ipcMain.on("quickadd:resize", (_, height) =>
  quickAddWindow?.setContentSize(
    QUICKADD_WIDTH,
    Math.max(QUICKADD_COMPACT_HEIGHT, Math.min(600, Math.round(height))),
  ),
);

// Recordatorio diario a las 9am
function scheduleDailyReminder() {
  const now = new Date();
  const next9am = new Date(now);
  next9am.setHours(9, 0, 0, 0);
  if (next9am <= now) next9am.setDate(next9am.getDate() + 1);
  const delay = next9am.getTime() - now.getTime();

  setTimeout(() => {
    const pending = db.getTasks("pending");
    if (pending.length > 0) {
      const due = db.getDueOrOverdue();
      const lines = due.slice(0, 4).map((t) => `• ${t.title}`);
      if (due.length > 4) lines.push(`… y ${due.length - 4} más`);
      const header = `Tienes ${pending.length} tarea${pending.length > 1 ? "s" : ""} pendiente${pending.length > 1 ? "s" : ""}`;
      const notification = new Notification({
        title: "📋 TaskFlow — Buenos días",
        body: due.length > 0 ? `${header}. Para hoy:\n${lines.join("\n")}` : header,
      });
      notification.on("click", showMainWindow);
      notification.show();
    }
    scheduleDailyReminder(); // reprogramar para mañana
  }, delay);
}

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  globalShortcut.register("CmdOrCtrl+Shift+Space", () => showQuickAdd());

  restoreReminders();
  scheduleDailyReminder();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
