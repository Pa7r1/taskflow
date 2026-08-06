const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "taskflow.db");
const db = new Database(dbPath);

// Pragmas de una app de escritorio local, aplicados antes de crear nada.
// - WAL: las lecturas no bloquean a la escritura, que es lo que ocurre cada vez
//   que la interfaz recarga la lista justo después de una mutación.
// - synchronous NORMAL: con WAL es seguro y evita un fsync por transacción.
// - foreign_keys: SQLite las ignora por defecto aunque estén declaradas.
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

/** Fecha de hoy en aaaa-mm-dd, en hora local (no UTC). */
function hoyISO() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

module.exports = { db, dbPath, hoyISO };
