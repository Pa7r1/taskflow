const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taskAPI", {
  // Tareas
  getTasks: (filter) => ipcRenderer.invoke("db:getTasks", filter),
  createTask: (task) => ipcRenderer.invoke("db:createTask", task),
  updateTask: (id, data) => ipcRenderer.invoke("db:updateTask", id, data),
  deleteTask: (id) => ipcRenderer.invoke("db:deleteTask", id),
  toggleTask: (id) => ipcRenderer.invoke("db:toggleTask", id),

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

  // Escuchar eventos
  onFocusQuickAdd: (cb) => ipcRenderer.on("focus:quickadd", cb),
  onDataChanged: (cb) => ipcRenderer.on("data:changed", cb),
});
