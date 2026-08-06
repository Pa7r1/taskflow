const { ipcMain } = require("electron");
const db = require("./db");
const recordatorios = require("./reminders");
const {
  broadcastDataChanged,
  hideQuickAdd,
  resizeQuickAdd,
} = require("./windows");

// Registra un handler que no deja escapar una excepción sin registrar. El error
// se relanza para que el renderer lo reciba como promesa rechazada y lo muestre;
// sin este envoltorio, un fallo de SQLite dejaba la interfaz muda.
function manejar(canal, fn) {
  ipcMain.handle(canal, async (evento, ...args) => {
    try {
      return await fn(evento, ...args);
    } catch (error) {
      console.error(`[ipc] ${canal} falló:`, error);
      throw error;
    }
  });
}

function registrarHandlers() {
  // ─ Lecturas ─
  manejar("db:getTasks", (_, filtro) => db.getTasks(filtro));
  manejar("db:getCounts", () => db.getCounts());
  manejar("db:getCategories", () => db.getCategories());

  // ─ Mutaciones ─ todas anuncian el cambio a las ventanas al terminar.
  manejar("db:createTask", (_, tarea) => {
    const creada = db.createTask(tarea);
    if (creada.reminder_at)
      recordatorios.programar(creada.id, creada.reminder_at);
    broadcastDataChanged();
    return creada;
  });

  manejar("db:updateTask", (_, id, datos) => {
    const actualizada = db.updateTask(id, datos);
    if ("reminder_at" in datos) {
      datos.reminder_at
        ? recordatorios.programar(id, datos.reminder_at)
        : recordatorios.cancelar(id);
    }
    broadcastDataChanged();
    return actualizada;
  });

  manejar("db:deleteTask", (_, id) => {
    const resultado = db.deleteTask(id);
    recordatorios.cancelar(id);
    broadcastDataChanged();
    return resultado;
  });

  manejar("db:toggleTask", (_, id) => {
    const tarea = db.toggleTask(id);
    // Completar una tarea silencia su recordatorio; descompletarla lo devuelve.
    if (tarea?.completed) recordatorios.cancelar(id);
    else if (tarea?.reminder_at) recordatorios.programar(id, tarea.reminder_at);
    broadcastDataChanged();
    return tarea;
  });

  manejar("db:createCategory", (_, nombre, color) => {
    const creada = db.createCategory(nombre, color);
    broadcastDataChanged();
    return creada;
  });

  manejar("notify:schedule", (_, taskId, cuando) =>
    recordatorios.programar(taskId, cuando),
  );

  // ─ Ventana quick-add ─ sin respuesta, son órdenes.
  ipcMain.on("window:closeQuickAdd", hideQuickAdd);
  ipcMain.on("quickadd:resize", (_, alto) => resizeQuickAdd(alto));
}

module.exports = { registrarHandlers };
