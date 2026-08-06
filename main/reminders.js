const { Notification } = require("electron");
const db = require("./db");
const { showMainWindow } = require("./windows");

const HORA_RESUMEN_DIARIO = 9;
const MAX_TAREAS_EN_RESUMEN = 4;

// Recordatorios programados en memoria, indexados por tarea para poder
// reprogramarlos o cancelarlos (al completar o eliminar la tarea).
const temporizadores = new Map();
let temporizadorDiario = null;

function cancelar(taskId) {
  const t = temporizadores.get(taskId);
  if (t) {
    clearTimeout(t);
    temporizadores.delete(taskId);
  }
}

function cancelarTodos() {
  for (const id of [...temporizadores.keys()]) cancelar(id);
  clearTimeout(temporizadorDiario);
  temporizadorDiario = null;
}

function notificar(titulo, cuerpo) {
  const n = new Notification({ title: titulo, body: cuerpo });
  n.on("click", showMainWindow);
  n.show();
}

function programar(taskId, cuando) {
  cancelar(taskId);
  if (!db.getTaskById(taskId)) return;

  const espera = new Date(cuando).getTime() - Date.now();
  if (Number.isNaN(espera) || espera <= 0) return;

  temporizadores.set(
    taskId,
    setTimeout(() => {
      temporizadores.delete(taskId);
      // Releer la tarea: pudo cambiar de título o completarse mientras esperaba.
      const tarea = db.getTaskById(taskId);
      if (!tarea || tarea.completed) return;
      notificar("⏰ TaskFlow — Recordatorio", tarea.title);
    }, espera),
  );
}

/**
 * Reconstruye todos los recordatorios desde la base.
 *
 * Se usa al arrancar (los setTimeout no sobreviven a un reinicio) y al despertar
 * de una suspensión: mientras el equipo duerme los temporizadores no avanzan,
 * así que uno de "dentro de 2 horas" llegaría tarde. Reanclarlos contra el reloj
 * real es la única forma de que suenen a su hora.
 */
function restaurar() {
  for (const id of [...temporizadores.keys()]) cancelar(id);
  for (const tarea of db.getPendingReminders()) {
    programar(tarea.id, tarea.reminder_at);
  }
}

function cuerpoDelResumen(pendientes, paraHoy) {
  const plural = pendientes.length > 1 ? "s" : "";
  const cabecera = `Tienes ${pendientes.length} tarea${plural} pendiente${plural}`;
  if (paraHoy.length === 0) return cabecera;

  const lineas = paraHoy
    .slice(0, MAX_TAREAS_EN_RESUMEN)
    .map((t) => `• ${t.title}`);
  if (paraHoy.length > MAX_TAREAS_EN_RESUMEN)
    lineas.push(`… y ${paraHoy.length - MAX_TAREAS_EN_RESUMEN} más`);
  return `${cabecera}. Para hoy:\n${lineas.join("\n")}`;
}

/** Resumen diario a las 9. Se reprograma solo cada día. */
function programarResumenDiario() {
  clearTimeout(temporizadorDiario);

  const ahora = new Date();
  const proxima = new Date(ahora);
  proxima.setHours(HORA_RESUMEN_DIARIO, 0, 0, 0);
  if (proxima <= ahora) proxima.setDate(proxima.getDate() + 1);

  temporizadorDiario = setTimeout(() => {
    const pendientes = db.getTasks("pending");
    if (pendientes.length > 0) {
      notificar(
        "📋 TaskFlow — Buenos días",
        cuerpoDelResumen(pendientes, db.getDueOrOverdue()),
      );
    }
    programarResumenDiario();
  }, proxima.getTime() - ahora.getTime());
}

module.exports = {
  programar,
  cancelar,
  cancelarTodos,
  restaurar,
  programarResumenDiario,
};
