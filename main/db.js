const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "taskflow.db");
const db = new Database(dbPath);

// Esquema
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

module.exports = {
  getTasks(filter = "all") {
    let query = `SELECT t.*, c.name as category_name, c.color as category_color
                 FROM tasks t LEFT JOIN categories c ON t.category_id = c.id`;
    const today = new Date().toISOString().split("T")[0];

    if (filter === "today") {
      query += ` WHERE (t.due_date = '${today}' OR t.due_date IS NULL) AND t.completed = 0`;
    } else if (filter === "pending") {
      query += ` WHERE t.completed = 0`;
    } else if (filter === "completed") {
      query += ` WHERE t.completed = 1`;
    } else if (!isNaN(filter)) {
      query += ` WHERE t.category_id = ${parseInt(filter)}`;
    }

    query += ` ORDER BY t.completed ASC, t.priority DESC, t.created_at DESC`;
    return db.prepare(query).all();
  },

  createTask(task) {
    const stmt = db.prepare(`
      INSERT INTO tasks (title, notes, priority, category_id, due_date, reminder_at)
      VALUES (@title, @notes, @priority, @category_id, @due_date, @reminder_at)
    `);
    const result = stmt.run(task);
    return db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(result.lastInsertRowid);
  },

  updateTask(id, data) {
    const fields = Object.keys(data)
      .map((k) => `${k} = @${k}`)
      .join(", ");
    db.prepare(
      `UPDATE tasks SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`,
    ).run({ ...data, id });
    return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  },

  deleteTask(id) {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return { success: true };
  },

  toggleTask(id) {
    db.prepare(
      "UPDATE tasks SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(id);
    return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  },

  getCategories() {
    return db.prepare("SELECT * FROM categories ORDER BY id").all();
  },

  createCategory(name, color) {
    const result = db
      .prepare("INSERT INTO categories (name, color) VALUES (?, ?)")
      .run(name, color);
    return db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(result.lastInsertRowid);
  },

  getTaskById(id) {
    return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  },

  getPendingReminders() {
    // reminder_at se guarda en hora local (datetime-local); el filtrado de
    // recordatorios ya vencidos lo hace scheduleNotification al parsear la fecha.
    return db
      .prepare(
        "SELECT * FROM tasks WHERE reminder_at IS NOT NULL AND completed = 0",
      )
      .all();
  },

  getDueOrOverdue() {
    return db
      .prepare(
        "SELECT * FROM tasks WHERE due_date IS NOT NULL AND due_date <= ? AND completed = 0 ORDER BY due_date ASC",
      )
      .all(new Date().toISOString().split("T")[0]);
  },
};
