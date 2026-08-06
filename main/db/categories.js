const { db } = require("./connection");

const q = {
  todas: db.prepare("SELECT * FROM categories ORDER BY id"),
  insertar: db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)"),
  porId: db.prepare("SELECT * FROM categories WHERE id = ?"),
};

module.exports = {
  getCategories() {
    return q.todas.all();
  },

  createCategory(name, color) {
    const resultado = q.insertar.run(name, color);
    return q.porId.get(resultado.lastInsertRowid);
  },
};
