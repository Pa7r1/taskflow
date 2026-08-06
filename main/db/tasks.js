const { db, hoyISO } = require("./connection");

// Las consultas se preparan una sola vez al cargar el módulo. Construir el SQL
// por concatenación en cada llamada obligaba a SQLite a analizarlo y
// planificarlo de nuevo cada vez, en el mismo hilo que dibuja la interfaz.

const SELECT = `
  SELECT t.*, c.name AS category_name, c.color AS category_color
  FROM tasks t
  LEFT JOIN categories c ON t.category_id = c.id`;

// Las completadas al final; dentro de cada grupo, primero las urgentes.
// El CASE es necesario: ordenar por el texto de `priority` coloca 'high' al
// final ('normal' > 'low' > 'high' alfabéticamente), justo al revés.
const ORDEN = `
  ORDER BY t.completed ASC,
           CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
           t.created_at DESC`;

// "Pendientes" es donde se recogen las vencidas, así que van arriba del todo:
// son las que exigen una decisión. Dentro de cada bloque manda la prioridad.
const ORDEN_PENDIENTES = `
  ORDER BY CASE WHEN t.due_date IS NOT NULL AND t.due_date < @hoy THEN 0 ELSE 1 END,
           CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
           t.due_date IS NULL,
           t.due_date ASC,
           t.created_at DESC`;

const q = {
  todas: db.prepare(`${SELECT} ${ORDEN}`),
  // "Hoy" son las tareas que vencen hoy y nada más. Las que no tienen fecha y
  // las ya vencidas viven en "Pendientes".
  hoy: db.prepare(
    `${SELECT} WHERE t.due_date = ? AND t.completed = 0 ${ORDEN}`,
  ),
  pendientes: db.prepare(`${SELECT} WHERE t.completed = 0 ${ORDEN_PENDIENTES}`),
  completadas: db.prepare(`${SELECT} WHERE t.completed = 1 ${ORDEN}`),
  porCategoria: db.prepare(`${SELECT} WHERE t.category_id = ? ${ORDEN}`),

  // Contadores para la barra lateral. Se calculan en SQL sobre la tabla entera:
  // deducirlos de la lista que se está mostrando daba cifras falsas en cuanto el
  // filtro activo no era "todas".
  contadores: db.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE completed = 0)                        AS pendientes,
      COUNT(*) FILTER (WHERE completed = 0 AND due_date = @hoy)    AS hoy,
      COUNT(*) FILTER (WHERE completed = 0 AND due_date IS NOT NULL
                             AND due_date < @hoy)                  AS vencidas
    FROM tasks`),

  porId: db.prepare("SELECT * FROM tasks WHERE id = ?"),
  insertar: db.prepare(`
    INSERT INTO tasks (title, notes, priority, category_id, due_date, reminder_at)
    VALUES (@title, @notes, @priority, @category_id, @due_date, @reminder_at)`),
  borrar: db.prepare("DELETE FROM tasks WHERE id = ?"),
  alternar: db.prepare(
    "UPDATE tasks SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),

  conRecordatorio: db.prepare(
    "SELECT * FROM tasks WHERE reminder_at IS NOT NULL AND completed = 0",
  ),
  vencidasOParaHoy: db.prepare(
    "SELECT * FROM tasks WHERE due_date IS NOT NULL AND due_date <= ? AND completed = 0 ORDER BY due_date ASC",
  ),
};

// Columnas que el renderer puede modificar. Sin esta lista, `updateTask`
// interpolaba en el SQL cualquier clave que llegara por IPC.
const COLUMNAS_EDITABLES = new Set([
  "title",
  "notes",
  "completed",
  "priority",
  "category_id",
  "due_date",
  "reminder_at",
]);

// `updateTask` recibe un subconjunto variable de columnas, así que su SQL no se
// puede preparar por adelantado. Se cachea por combinación de columnas, que son
// pocas y siempre las mismas.
const cacheActualizaciones = new Map();

function statementActualizar(columnas) {
  const clave = columnas.join(",");
  let stmt = cacheActualizaciones.get(clave);
  if (!stmt) {
    const asignaciones = columnas.map((c) => `${c} = @${c}`).join(", ");
    stmt = db.prepare(
      `UPDATE tasks SET ${asignaciones}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`,
    );
    cacheActualizaciones.set(clave, stmt);
  }
  return stmt;
}

module.exports = {
  /**
   * @param {string} filter "today" | "pending" | "completed" | "all", o el id
   *                        numérico de una categoría en forma de string.
   */
  getTasks(filter = "all") {
    if (filter === "today") return q.hoy.all(hoyISO());
    if (filter === "pending") return q.pendientes.all({ hoy: hoyISO() });
    if (filter === "completed") return q.completadas.all();

    const categoriaId = Number.parseInt(filter, 10);
    if (Number.isInteger(categoriaId)) return q.porCategoria.all(categoriaId);

    return q.todas.all();
  },

  getTaskById(id) {
    return q.porId.get(id);
  },

  createTask(task) {
    const resultado = q.insertar.run({
      title: task.title,
      notes: task.notes ?? "",
      priority: task.priority ?? "normal",
      category_id: task.category_id ?? null,
      due_date: task.due_date ?? null,
      reminder_at: task.reminder_at ?? null,
    });
    return q.porId.get(resultado.lastInsertRowid);
  },

  updateTask(id, data) {
    const columnas = Object.keys(data ?? {}).filter((c) =>
      COLUMNAS_EDITABLES.has(c),
    );
    // Sin columnas válidas no hay nada que escribir. Antes, un `data` vacío
    // generaba SQL inválido y un `data` con una clave inesperada la interpolaba.
    if (columnas.length === 0) return q.porId.get(id);

    const valores = { id };
    for (const c of columnas) valores[c] = data[c];
    statementActualizar(columnas).run(valores);
    return q.porId.get(id);
  },

  deleteTask(id) {
    return { success: q.borrar.run(id).changes > 0 };
  },

  toggleTask(id) {
    q.alternar.run(id);
    return q.porId.get(id);
  },

  /** @returns {{pendientes:number, hoy:number, vencidas:number}} */
  getCounts() {
    return q.contadores.get({ hoy: hoyISO() });
  },

  getPendingReminders() {
    // reminder_at se guarda en hora local (datetime-local); descartar los ya
    // vencidos es cosa de quien programa la notificación, que parsea la fecha.
    return q.conRecordatorio.all();
  },

  getDueOrOverdue() {
    return q.vencidasOParaHoy.all(hoyISO());
  },
};
