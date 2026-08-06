const { db } = require("./connection");

// `CREATE TABLE IF NOT EXISTS` no altera una tabla que ya existe, así que los
// cambios de esquema sobre una instalación viva necesitan su propia migración.
// `user_version` lleva la cuenta de cuáles se han aplicado.
const ESQUEMA_ACTUAL = 1;

function crearTablas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT DEFAULT '',
      completed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      category_id INTEGER REFERENCES categories(id),
      due_date TEXT,
      reminder_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO categories (id, name, color) VALUES
      (1, 'Personal', '#6366f1'),
      (2, 'Trabajo', '#f59e0b'),
      (3, 'Ideas', '#10b981');
  `);
}

// Cada bloque sube exactamente una versión y se aplica una sola vez. Para añadir
// una migración: subir ESQUEMA_ACTUAL y añadir su `if (version < N)`.
function migrar() {
  const version = db.pragma("user_version", { simple: true });
  if (version >= ESQUEMA_ACTUAL) return;

  if (version < 1) {
    // Índices sobre las columnas por las que se filtra en `getTasks`. Sin ellos,
    // cada filtro recorre la tabla entera.
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_completed_due
        ON tasks (completed, due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_category
        ON tasks (category_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_reminder
        ON tasks (reminder_at) WHERE reminder_at IS NOT NULL;
    `);
  }

  db.pragma(`user_version = ${ESQUEMA_ACTUAL}`);
}

function inicializar() {
  crearTablas();
  migrar();
}

module.exports = { inicializar, ESQUEMA_ACTUAL };
