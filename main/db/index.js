// Punto de entrada de la capa de datos. El resto del proceso main solo conoce
// este módulo; nadie más abre la base ni escribe SQL.
//
//   connection.js  — abre el fichero y fija los pragmas
//   schema.js      — crea las tablas y aplica las migraciones versionadas
//   tasks.js       — consultas de tareas
//   categories.js  — consultas de categorías

const { db } = require("./connection");
const { inicializar } = require("./schema");

// El esquema debe existir antes de que tasks.js y categories.js preparen sus
// statements: `db.prepare` falla si la tabla todavía no está.
inicializar();

const tasks = require("./tasks");
const categories = require("./categories");

module.exports = {
  ...tasks,
  ...categories,
  close() {
    db.close();
  },
};
