"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const test = require("node:test");
const Module = require("node:module");

const REPO_ROOT = path.join(__dirname, "..");
const MAIN_PATH = path.join(REPO_ROOT, "main/main.js");
const WINDOWS_PATH = path.join(REPO_ROOT, "main/windows.js");

function loadMain({ lock = true } = {}) {
  delete require.cache[MAIN_PATH];
  delete require.cache[WINDOWS_PATH];

  const calls = [];
  const imports = [];
  const app = new EventEmitter();
  let ready = false;
  let readyResolve;
  Object.assign(app, {
    isPackaged: true,
    requestSingleInstanceLock: () => {
      calls.push("requestSingleInstanceLock");
      return lock;
    },
    quit: () => calls.push("app.quit"),
    exit: (code = 0) => calls.push(`app.exit:${code}`),
    getPath: (name) => `/tmp/taskflow-${name}`,
    isReady: () => ready,
    whenReady: () => {
      calls.push("whenReady");
      return new Promise((resolve) => {
        readyResolve = resolve;
      });
    },
  });

  const allWindows = [];
  let nextWindowId = 1;
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      Object.assign(this, {
        id: nextWindowId++,
        options,
        visible: false,
        minimized: false,
        focused: false,
        closed: false,
        webContents: { send: (...args) => calls.push(["send", ...args]) },
      });
      allWindows.push(this);
      calls.push(["BrowserWindow", this.id]);
    }
    loadFile(file, options) {
      this.loaded = ["file", file, options];
    }
    loadURL(url) {
      this.loaded = ["url", url];
    }
    show() {
      this.visible = true;
    }
    hide() {
      this.visible = false;
    }
    focus() {
      this.focused = true;
    }
    minimize() {
      this.minimized = true;
      this.visible = false;
    }
    restore() {
      this.minimized = false;
      this.visible = true;
      calls.push(["restore", this.id]);
    }
    isMinimized() {
      return this.minimized;
    }
    setPosition() {}
    setContentSize() {}
  }
  BrowserWindow.getAllWindows = () => allWindows.filter((win) => !win.closed);

  const electron = {
    app,
    BrowserWindow,
    Notification: { isSupported: () => false },
    globalShortcut: {
      register: (...args) => calls.push(["globalShortcut.register", ...args]),
      unregisterAll: () => calls.push("globalShortcut.unregisterAll"),
    },
    powerMonitor: new EventEmitter(),
    screen: {
      getPrimaryDisplay: () => ({ workAreaSize: { width: 1200, height: 800 } }),
    },
  };

  const stubs = new Map([
    ["main/db/index.js", ["db", { close: () => calls.push("db.close") }]],
    [
      "main/reminders.js",
      [
        "reminders",
        {
          restaurar: () => calls.push("reminders.restaurar"),
          programarResumenDiario: () =>
            calls.push("reminders.programarResumenDiario"),
          cancelarTodos: () => calls.push("reminders.cancelarTodos"),
        },
      ],
    ],
    [
      "main/ipc.js",
      ["ipc", { registrarHandlers: () => calls.push("ipc.registrarHandlers") }],
    ],
    [
      "main/tray.js",
      [
        "tray",
        {
          createTray: () => calls.push("tray.createTray"),
          destroyTray: () => calls.push("tray.destroyTray"),
        },
      ],
    ],
  ]);

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "electron") return electron;
    const resolved = Module._resolveFilename(request, parent, isMain);
    const relative = path
      .relative(REPO_ROOT, resolved)
      .replaceAll(path.sep, "/");
    if (stubs.has(relative)) {
      const [name, stub] = stubs.get(relative);
      imports.push(name);
      calls.push(`import:${name}`);
      return stub;
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    require(MAIN_PATH);
  } finally {
    Module._load = originalLoad;
  }

  return {
    app,
    calls,
    imports,
    get windows() {
      return BrowserWindow.getAllWindows();
    },
    async ready() {
      assert.ok(readyResolve, "main registered app.whenReady");
      ready = true;
      readyResolve();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("lock denial quits before backend imports or runtime handlers", () => {
  const ctx = loadMain({ lock: false });
  assert.deepEqual(ctx.calls, ["requestSingleInstanceLock", "app.quit"]);
  assert.deepEqual(ctx.imports, []);
  assert.equal(ctx.app.listenerCount("second-instance"), 0);
  assert.equal(ctx.app.listenerCount("before-quit"), 0);
  assert.equal(ctx.app.listenerCount("will-quit"), 0);
});

test("winning startup acquires lock before side-effect modules and creates one main window", async () => {
  const ctx = loadMain({ lock: true });
  assert.equal(ctx.calls[0], "requestSingleInstanceLock");
  assert.deepEqual(ctx.imports, ["db", "reminders", "ipc", "tray"]);
  await ctx.ready();
  assert.equal(ctx.windows.length, 1);
  assert.equal(
    ctx.calls.filter(
      (call) => Array.isArray(call) && call[0] === "BrowserWindow",
    ).length,
    1,
  );
  assert.ok(ctx.calls.includes("ipc.registrarHandlers"));
  assert.ok(ctx.calls.includes("tray.createTray"));
  assert.ok(ctx.calls.includes("reminders.restaurar"));
});

test("early and normal second-instance focus existing main without duplicates", async () => {
  const ctx = loadMain({ lock: true });
  ctx.app.emit("second-instance");
  assert.equal(
    ctx.windows.length,
    0,
    "early second-instance waits for readiness",
  );

  await ctx.ready();
  const main = ctx.windows[0];
  main.focused = false;
  ctx.app.emit("second-instance");
  assert.equal(ctx.windows.length, 1);
  assert.equal(ctx.windows[0], main);
  assert.equal(main.visible, true);
  assert.equal(main.focused, true);
});

test("second-instance and activate restore minimized or hidden main window", async () => {
  const ctx = loadMain({ lock: true });
  await ctx.ready();
  const main = ctx.windows[0];

  main.minimize();
  ctx.app.emit("second-instance");
  assert.equal(main.minimized, false);
  assert.equal(main.visible, true);
  assert.equal(main.focused, true);

  main.focused = false;
  main.hide();
  ctx.app.emit("activate");
  assert.equal(ctx.windows.length, 1);
  assert.equal(main.visible, true);
  assert.equal(main.focused, true);
});
