const { contextBridge, ipcRenderer } = require("electron");

// Suscribe `cb` a un canal y devuelve la función que la da de baja. Devolverla no
// es un detalle: sin ella el renderer no puede limpiar en el cleanup de su efecto,
// y con el HMR de Vite los listeners se apilan en cada recarga hasta que un solo
// evento dispara N recargas de datos.
function subscribe(channel, cb) {
  const handler = (_event, ...args) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("taskAPI", {
  // Tareas
  getTasks: (filter) => ipcRenderer.invoke("db:getTasks", filter),
  createTask: (task) => ipcRenderer.invoke("db:createTask", task),
  updateTask: (id, data) => ipcRenderer.invoke("db:updateTask", id, data),
  deleteTask: (id) => ipcRenderer.invoke("db:deleteTask", id),
  toggleTask: (id) => ipcRenderer.invoke("db:toggleTask", id),

  // Contadores de la barra lateral, calculados en SQL sobre la tabla entera
  getCounts: () => ipcRenderer.invoke("db:getCounts"),

  // Categorías
  getCategories: () => ipcRenderer.invoke("db:getCategories"),
  createCategory: (name, color) =>
    ipcRenderer.invoke("db:createCategory", name, color),

  // Notificaciones
  scheduleNotification: (taskId, time) =>
    ipcRenderer.invoke("notify:schedule", taskId, time),

  // Ventana quick-add
  closeQuickAdd: () => ipcRenderer.send("window:closeQuickAdd"),
  resizeQuickAdd: (height) => ipcRenderer.send("quickadd:resize", height),

  // Escuchar eventos. Ambos devuelven su función de baja: úsala en el cleanup.
  onFocusQuickAdd: (cb) => subscribe("focus:quickadd", cb),
  onDataChanged: (cb) => subscribe("data:changed", cb),
});
