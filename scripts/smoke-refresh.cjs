#!/usr/bin/env node
// Smoke test for the reload scheduler against real Electron windows.
// Parent mode owns a fresh temp userData directory, launches this same file under
// the project's Electron binary, and removes only that owned directory after the
// child exits. Child mode loads main/main.js with synthetic data and counts real
// database calls from the renderer. Secondary-child mode uses the same isolated
// userData and imports main/main.js without touching the database first, proving
// the single-instance loser quits before backend side effects.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const REPO_ROOT = path.join(__dirname, "..");
const INTERNAL_TIMEOUT_MS = 60000;

if (process.env.TASKFLOW_SMOKE_CHILD !== "1") runParent();
else {
  const childMain =
    process.env.TASKFLOW_SMOKE_SECONDARY === "1" ? runSecondaryChild : runChild;
  childMain().catch((e) => {
    console.error(`[smoke] FAILED: ${e.stack || e.message}`);
    try {
      require("electron").app.exit(1);
    } catch {
      process.exit(1);
    }
  });
}

function electronBin() {
  // Node resolves the actual executable, avoiding shell-only .cmd shims on Windows.
  return require("electron");
}

function currentElectronBin() {
  return process.versions.electron ? process.execPath : electronBin();
}

function runParent() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-smoke-"));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.TASKFLOW_SMOKE_CHILD = "1";
  env.TASKFLOW_SMOKE_USER_DATA = userDataDir;

  const child = spawn(electronBin(), [__filename], {
    cwd: REPO_ROOT,
    env,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });

  let timedOut = false;
  let forceKillTimer;
  const timer = setTimeout(() => {
    timedOut = true;
    console.error(`[smoke] FAILED: internal ${INTERNAL_TIMEOUT_MS}ms deadline`);
    forceKillTimer = stopChild(child);
  }, INTERNAL_TIMEOUT_MS);

  child.on("error", (error) => {
    clearTimeout(timer);
    clearTimeout(forceKillTimer);
    cleanupOwnedDir(userDataDir);
    console.error(
      `[smoke] FAILED: could not launch Electron: ${error.message}`,
    );
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    clearTimeout(timer);
    clearTimeout(forceKillTimer);
    const cleaned = cleanupOwnedDir(userDataDir);
    if (timedOut || !cleaned) {
      process.exitCode = 1;
      return;
    }
    console.log(
      `[smoke] owned temp userData removed: ${!fs.existsSync(userDataDir)} (${userDataDir})`,
    );
    if (code === 0) {
      process.exitCode = 0;
      return;
    }
    console.error(`[smoke] FAILED: child exited code=${code} signal=${signal}`);
    process.exitCode = code || 1;
  });
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch {}
  return setTimeout(() => {
    try {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    } catch {}
  }, 1500).unref();
}

function cleanupOwnedDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error(
      `[smoke] FAILED: could not remove owned temp dir: ${error.message}`,
    );
    return false;
  }
}

function validateUserDataDir() {
  const userDataDir = process.env.TASKFLOW_SMOKE_USER_DATA;
  if (
    !userDataDir ||
    !path.basename(userDataDir).startsWith("taskflow-smoke-")
  ) {
    throw new Error("Missing owned smoke userData directory");
  }
  return userDataDir;
}

async function runSecondaryChild() {
  const userDataDir = validateUserDataDir();
  const { app } = require("electron");
  app.setPath("userData", userDataDir);
  // Test-only packaged mode: load renderer/dist without changing production code.
  Object.defineProperty(app, "isPackaged", { get: () => true });

  require(path.join(REPO_ROOT, "main/main.js"));

  setTimeout(() => {
    console.error("[smoke-secondary] FAILED: lock loser did not quit promptly");
    app.exit(2);
  }, 5000).unref();
}

async function runChild() {
  const userDataDir = validateUserDataDir();
  const { app, BrowserWindow } = require("electron");
  app.setPath("userData", userDataDir);
  // Test-only packaged mode: load renderer/dist without changing production code.
  Object.defineProperty(app, "isPackaged", { get: () => true });

  const db = require(path.join(REPO_ROOT, "main/db"));
  const counters = { tasks: 0, categories: 0 };
  const getTasksOriginal = db.getTasks;
  db.getTasks = (...args) => {
    counters.tasks++;
    return getTasksOriginal(...args);
  };
  const getCategoriesOriginal = db.getCategories;
  db.getCategories = (...args) => {
    counters.categories++;
    return getCategoriesOriginal(...args);
  };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const trabajo = db.createCategory("Trabajo", "#5b8def");
  db.createTask({
    title: "Tarea de humo",
    priority: "normal",
    category_id: trabajo.id,
  });
  db.createTask({ title: "Entrega de hoy", priority: "high", due_date: today });
  db.createTask({
    title: "Factura vencida",
    priority: "high",
    due_date: yesterday,
  });

  const started = Date.now();
  const limitMs = 55000;
  async function waitUntil(condition, message, timeoutMs = limitMs) {
    const deadline = Math.min(started + limitMs, Date.now() + timeoutMs);
    while (!(await condition())) {
      if (Date.now() > deadline)
        throw new Error(`Timed out waiting for: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
  const log = (message) => console.log(`[smoke] ${message}`);

  function mainWindowsExcludingQuickAdd(quickWindow) {
    return BrowserWindow.getAllWindows().filter((win) => win !== quickWindow);
  }

  async function waitForProcessExit(child, label, timeoutMs = 10000) {
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });

    return await new Promise((resolve, reject) => {
      let timedOut = false;
      let timeoutError;
      let forceKillTimer;
      const timer = setTimeout(() => {
        timedOut = true;
        timeoutError = new Error(`${label} timed out; output:\n${output}`);
        child.kill("SIGTERM");
        forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1500);
      }, timeoutMs);
      child.on("error", (error) => {
        clearTimeout(timer);
        clearTimeout(forceKillTimer);
        reject(error);
      });
      child.on("exit", (code, signal) => {
        clearTimeout(timer);
        clearTimeout(forceKillTimer);
        if (timedOut) {
          reject(timeoutError);
          return;
        }
        if (code === 0) resolve({ code, signal, output });
        else
          reject(
            new Error(
              `${label} exited code=${code} signal=${signal}; output:\n${output}`,
            ),
          );
      });
    });
  }

  async function launchSecondaryAndAssertFocus(mainWindow, quickWindow, label) {
    const originalMainId = mainWindow.id;
    const originalPid = process.pid;
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    env.TASKFLOW_SMOKE_CHILD = "1";
    env.TASKFLOW_SMOKE_SECONDARY = "1";
    env.TASKFLOW_SMOKE_USER_DATA = userDataDir;

    const secondary = spawn(currentElectronBin(), [__filename], {
      cwd: REPO_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    await waitForProcessExit(secondary, label);
    await waitUntil(
      () => mainWindow.isVisible(),
      `${label} shows existing main`,
    );

    if (process.pid !== originalPid)
      throw new Error(`${label} changed primary process PID`);
    if (mainWindow.id !== originalMainId)
      throw new Error(`${label} replaced main BrowserWindow`);
    if (mainWindowsExcludingQuickAdd(quickWindow).length !== 1) {
      throw new Error(`${label} left duplicate main windows`);
    }
    if (windows.getMainWindow() !== mainWindow) {
      throw new Error(`${label} changed the tracked main window`);
    }
    log(
      `${label}: secondary exited and focused existing main id=${mainWindow.id} pid=${process.pid}`,
    );
  }

  async function waitForStableCounters(ms = 180) {
    let last = `${counters.tasks}:${counters.categories}`;
    let stableSince = Date.now();
    while (Date.now() - stableSince < ms) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      const next = `${counters.tasks}:${counters.categories}`;
      if (next !== last) {
        last = next;
        stableSince = Date.now();
      }
      if (Date.now() - started > limitMs)
        throw new Error("Timed out waiting for stable counters");
    }
  }

  async function bodyIncludes(win, text) {
    return win.webContents.executeJavaScript(
      `document.body.innerText.includes(${JSON.stringify(text)})`,
    );
  }

  async function evalIn(win, script) {
    return win.webContents.executeJavaScript(script);
  }

  async function assertNoHorizontalOverflow(win, label) {
    const result = await evalIn(
      win,
      `(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const isVisibleInViewport = (selector) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight;
        };
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: viewportWidth,
          listVisible: isVisibleInViewport('[data-smoke="task-list"]'),
          detailVisible: isVisibleInViewport('[data-smoke="task-detail"]'),
          closeVisible: isVisibleInViewport('[aria-label="Cerrar detalle"]'),
          titleVisible: isVisibleInViewport('textarea[aria-label="Título de la tarea"]') && (document.querySelector('textarea[aria-label="Título de la tarea"]')?.getBoundingClientRect().height ?? 0) >= 40,
        };
      })();`,
    );
    if (result.scrollWidth > result.clientWidth + 1) {
      throw new Error(
        `${label} overflowed horizontally: ${result.scrollWidth}>${result.clientWidth}`,
      );
    }
    return result;
  }

  async function waitForRendererViewport(win, label) {
    await waitUntil(
      () =>
        evalIn(
          win,
          `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
            const root = document.documentElement;
            resolve(root.clientWidth > 0 && root.clientHeight > 0 && Math.abs(window.innerWidth - root.clientWidth) <= 1);
          })))`,
        ),
      `${label} renderer viewport`,
    );
  }

  async function waitForRenderIdle(win, name) {
    await evalIn(
      win,
      `Promise.race([
        (async () => {
          await (document.fonts?.ready || Promise.resolve());
          await Promise.all(
            document.getAnimations({ subtree: true })
              .filter((animation) => animation.playState !== 'finished')
              .map((animation) => animation.finished.catch(() => {})),
          );
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(${JSON.stringify(
          `Timed out waiting for render idle before screenshot: ${name}`,
        )})), 2500)),
      ])`,
    );
  }

  async function capturePage(win, name) {
    const dir = process.env.TASKFLOW_SMOKE_SCREENSHOTS;
    if (!dir) return;
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new Error(`Screenshot directory does not exist: ${dir}`);
    }
    await waitForRenderIdle(win, name);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, name), image.toPNG());
  }

  async function clickText(win, text) {
    const clicked = await evalIn(
      win,
      `(() => {
        const match = [...document.querySelectorAll('button')].find((button) =>
          button.innerText.includes(${JSON.stringify(text)})
        );
        if (!match) return false;
        match.click();
        return true;
      })();`,
    );
    if (!clicked) throw new Error(`Could not click button containing: ${text}`);
  }

  async function writeListInput(win, value) {
    return evalIn(
      win,
      `(() => {
        const el = document.querySelector('input[aria-label="Agregar tarea"]');
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })();`,
    );
  }

  async function readListInput(win) {
    return evalIn(
      win,
      `document.querySelector('input[aria-label="Agregar tarea"]')?.value`,
    );
  }

  const QUICK_INPUT = 'input[placeholder="¿Qué tienes en mente?"]';
  function readQuickInputScript() {
    return `document.querySelector(${JSON.stringify(QUICK_INPUT)})?.value`;
  }
  function writeQuickInputScript(value) {
    return `(() => {
      const el = document.querySelector(${JSON.stringify(QUICK_INPUT)});
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })();`;
  }

  require(path.join(REPO_ROOT, "main/main.js"));
  const windows = require(path.join(REPO_ROOT, "main/windows.js"));

  await app.whenReady();
  await waitUntil(
    () => BrowserWindow.getAllWindows().length > 0,
    "main window created",
  );
  const mainWindow = BrowserWindow.getAllWindows()[0];
  await waitUntil(
    () => !mainWindow.webContents.isLoading(),
    "main renderer loaded",
  );
  await waitUntil(
    () => counters.tasks >= 1 && counters.categories >= 1,
    "initial renderer data load",
  );
  await waitUntil(
    () => bodyIncludes(mainWindow, "Tarea de humo"),
    "initial task DOM",
  );
  await waitUntil(
    () =>
      bodyIncludes(mainWindow, "Para hoy") &&
      bodyIncludes(mainWindow, "Vencidas"),
    "global stats DOM",
  );
  const initialStats = await evalIn(
    mainWindow,
    `(() => [...document.querySelectorAll('[data-testid="global-stats"] dd')].map((el) => el.innerText).join(','))();`,
  );
  if (initialStats !== "3,1,1") {
    throw new Error(`Unexpected initial stats: ${initialStats}`);
  }
  await clickText(mainWindow, "Hoy");
  await waitUntil(
    () => bodyIncludes(mainWindow, "Tareas con fecha límite para hoy"),
    "today heading",
  );
  await clickText(mainWindow, "Trabajo");
  await waitUntil(
    () => bodyIncludes(mainWindow, "Tareas filtradas por categoría"),
    "category heading",
  );
  await clickText(mainWindow, "Pendientes");
  await waitUntil(
    async () =>
      (await bodyIncludes(mainWindow, "Todo lo que sigue abierto")) &&
      (await bodyIncludes(mainWindow, "Tarea de humo")) &&
      (await bodyIncludes(mainWindow, "Factura vencida")),
    "pending heading and rows",
  );

  for (const [width, height] of [
    [800, 500],
    [1100, 720],
    [1440, 900],
  ]) {
    mainWindow.setSize(width, height);
    await waitUntil(async () => {
      const [w, h] = mainWindow.getSize();
      return w === width && h === height;
    }, `resize ${width}x${height}`);
    await waitForRendererViewport(mainWindow, `resize ${width}x${height}`);
    const layout = await assertNoHorizontalOverflow(
      mainWindow,
      `main ${width}x${height}`,
    );
    if (!layout.listVisible || layout.detailVisible) {
      throw new Error(
        `Unexpected main layout at ${width}x${height}: ${JSON.stringify(layout)}`,
      );
    }
    await capturePage(mainWindow, `main-${width}x${height}.png`);
  }

  mainWindow.setSize(800, 500);
  await waitUntil(async () => {
    const [w, h] = mainWindow.getSize();
    return w === 800 && h === 500;
  }, "resize 800x500 detail");
  await waitForRendererViewport(mainWindow, "resize 800x500 detail");
  await writeListInput(mainWindow, "Borrador lista #trabajo");
  await clickText(mainWindow, "Tarea de humo");
  await waitUntil(
    () => bodyIncludes(mainWindow, "Volver a tareas"),
    "narrow detail open",
  );
  let detailLayout = await assertNoHorizontalOverflow(
    mainWindow,
    "detail 800x500",
  );
  if (
    detailLayout.listVisible ||
    !detailLayout.detailVisible ||
    !detailLayout.closeVisible ||
    !detailLayout.titleVisible
  ) {
    throw new Error(
      `Unexpected narrow detail layout: ${JSON.stringify(detailLayout)}`,
    );
  }
  await capturePage(mainWindow, "detail-800x500.png");

  // A lo ancho conviven lista y detalle: es la única vista donde se ve el estado
  // seleccionado de la fila, así que se comprueba que de verdad tenga fondo.
  mainWindow.setSize(1100, 720);
  await waitForRendererViewport(mainWindow, "selected row 1100x720");
  const selectedRow = await evalIn(
    mainWindow,
    `(() => {
      const row = document.querySelector('[data-smoke="task-list"] button[aria-pressed="true"]');
      if (!row) return { found: false };
      const style = getComputedStyle(row);
      const alpha = Number((style.backgroundColor.match(/[\\d.]+\\)$/) || ["1)"])[0].replace(")", ""));
      return { found: true, backgroundColor: style.backgroundColor, alpha };
    })();`,
  );
  if (!selectedRow.found || !(selectedRow.alpha > 0.05)) {
    throw new Error(
      `Selected row has no visible background: ${JSON.stringify(selectedRow)}`,
    );
  }
  await capturePage(mainWindow, "selected-1100x720.png");
  log(`selected row background ok: ${selectedRow.backgroundColor}`);
  mainWindow.setSize(800, 500);
  await waitForRendererViewport(mainWindow, "narrow detail again");
  await evalIn(
    mainWindow,
    `(async () => {
      const el = document.querySelector('textarea[aria-label="Título de la tarea"]');
      if (!el) return false;
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, "Tarea de humo editada");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      el.blur();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      document.querySelector('[aria-label="Cerrar detalle"]')?.click();
      return true;
    })();`,
  );
  await waitUntil(
    () => bodyIncludes(mainWindow, "Tarea de humo editada"),
    "edited task visible",
  );
  await waitUntil(
    async () => !(await bodyIncludes(mainWindow, "Volver a tareas")),
    "detail closed after autosave",
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (await bodyIncludes(mainWindow, "Volver a tareas")) {
    throw new Error("Closed detail reopened after autosave update resolved");
  }
  const listDraft = await readListInput(mainWindow);
  if (listDraft !== "Borrador lista #trabajo") {
    throw new Error(`List quick-input draft was lost: ${listDraft}`);
  }
  log(
    "ui metrics, filters, responsive detail, draft preservation and autosave race ok",
  );

  log(`prewarm ok: tasks=${counters.tasks} categories=${counters.categories}`);

  mainWindow.hide();
  await waitUntil(
    async () =>
      (await mainWindow.webContents.executeJavaScript(
        "document.visibilityState",
      )) === "hidden",
    "main window hidden",
  );
  const tasksBeforeHidden = counters.tasks;
  const categoriesBeforeHidden = counters.categories;
  db.createTask({ title: "Mutación en segundo plano", priority: "normal" });
  windows.broadcastDataChanged();
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (
    counters.tasks !== tasksBeforeHidden ||
    counters.categories !== categoriesBeforeHidden
  ) {
    throw new Error(
      `Hidden window queried data: tasks ${tasksBeforeHidden}->${counters.tasks}, categories ${categoriesBeforeHidden}->${counters.categories}`,
    );
  }
  log("hidden mutation: zero new queries, ok");

  mainWindow.show();
  await waitUntil(
    () => counters.tasks > tasksBeforeHidden,
    "main window reload after show",
  );
  await waitUntil(
    () => bodyIncludes(mainWindow, "Mutación en segundo plano"),
    "new task visible after reload",
  );
  await waitForStableCounters();
  log(`reopen refreshed task DOM: tasks=${counters.tasks}`);

  const tasksBeforeBurst = counters.tasks;
  for (let i = 0; i < 5; i++) windows.broadcastDataChanged();
  await waitUntil(
    () => counters.tasks > tasksBeforeBurst,
    "visible burst reload",
  );
  await waitForStableCounters();
  const burstIncrement = counters.tasks - tasksBeforeBurst;
  if (burstIncrement < 1 || burstIncrement > 2) {
    throw new Error(
      `Burst of 5 events produced ${burstIncrement} task queries; expected 1-2`,
    );
  }
  log(
    `visible burst coalesced: ${burstIncrement} task query/query interval(s)`,
  );

  const categoriesBeforeQuick = counters.categories;
  windows.showQuickAdd();
  await waitUntil(
    () => BrowserWindow.getAllWindows().length > 1,
    "quick-add window created",
  );
  const quick = BrowserWindow.getAllWindows().find((win) => win !== mainWindow);
  await waitUntil(
    () => !quick.webContents.isLoading(),
    "quick-add renderer loaded",
  );
  await waitUntil(
    () => counters.categories > categoriesBeforeQuick,
    "quick-add category prewarm",
  );
  await waitUntil(
    async () =>
      (await quick.webContents.executeJavaScript(readQuickInputScript())) ===
      "",
    "quick-add input ready",
  );
  await quick.webContents.executeJavaScript(
    writeQuickInputScript("Borrador de humo #trabajo"),
  );
  await waitUntil(
    () => bodyIncludes(quick, "Trabajo"),
    "initial category parsed",
  );

  const categoriesBeforeHide = counters.categories;
  db.createCategory("Personal", "#e07b39");
  quick.hide();
  await waitUntil(
    async () =>
      (await quick.webContents.executeJavaScript(
        "document.visibilityState",
      )) === "hidden",
    "quick-add hidden",
  );
  windows.showQuickAdd();
  await waitUntil(
    () => counters.categories > categoriesBeforeHide,
    "fresh categories after quick-add reopen",
  );
  const draft = await quick.webContents.executeJavaScript(
    readQuickInputScript(),
  );
  if (draft !== "Borrador de humo #trabajo")
    throw new Error(`Draft was not preserved after reopen: "${draft}"`);
  await quick.webContents.executeJavaScript(
    writeQuickInputScript("Borrador de humo #personal"),
  );
  await waitUntil(() => bodyIncludes(quick, "Personal"), "new category parsed");
  log("quick-add: fresh category parsing and draft preservation, ok");

  mainWindow.hide();
  await waitUntil(
    () => !mainWindow.isVisible(),
    "main window hidden before secondary launch",
  );
  await launchSecondaryAndAssertFocus(
    mainWindow,
    quick,
    "hidden-main single-instance",
  );

  mainWindow.minimize();
  let minimizedSupported = false;
  try {
    await waitUntil(
      () => mainWindow.isMinimized(),
      "main window minimized",
      1500,
    );
    minimizedSupported = true;
  } catch (error) {
    log(
      `minimize unsupported in this runtime; unit test covers minimized restore (${error.message})`,
    );
    mainWindow.hide();
    await waitUntil(
      () => !mainWindow.isVisible(),
      "main hidden after minimize fallback",
    );
  }
  await launchSecondaryAndAssertFocus(
    mainWindow,
    quick,
    "minimized-main single-instance",
  );
  if (minimizedSupported && mainWindow.isMinimized()) {
    throw new Error("secondary launch did not restore minimized main window");
  }

  log("smoke complete: all checks passed");
  app.exit(0);
}
