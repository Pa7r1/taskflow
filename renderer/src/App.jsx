import { useState, useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TaskList from "./components/TaskList";
import TaskDetail from "./components/TaskDetail";
import QuickAdd from "./components/QuickAdd";

const isQuickAdd =
  new URLSearchParams(window.location.search).get("mode") === "quickadd";

export default function App() {
  // "Pendientes" y no "Hoy": "Hoy" son solo las tareas que vencen hoy, así que
  // arrancar ahí deja la pantalla vacía a quien no usa fechas límite. En
  // "Pendientes" está todo lo que queda por hacer, con las vencidas arriba.
  const [filter, setFilter] = useState("pending");
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [counts, setCounts] = useState({ pendientes: 0, hoy: 0, vencidas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Único camino de recarga de datos.
  //
  // Toda mutación hace que el proceso main emita `data:changed` a todas las ventanas,
  // y es ese evento —no la mutación— el que dispara la recarga. Así el popup quick-add
  // y la ventana principal se refrescan por el mismo mecanismo, y una mutación cuesta
  // una consulta en vez de dos.
  //
  // El efecto se resuscribe al cambiar el filtro, de modo que el handler siempre lee
  // el filtro vigente sin necesidad de un ref.
  useEffect(() => {
    if (isQuickAdd) return;
    let cancelado = false;

    const cargar = async () => {
      try {
        const [nuevasTareas, nuevasCategorias, nuevosContadores] =
          await Promise.all([
            window.taskAPI.getTasks(filter),
            window.taskAPI.getCategories(),
            window.taskAPI.getCounts(),
          ]);
        if (cancelado) return;
        setTasks(nuevasTareas);
        setCategories(nuevasCategorias);
        setCounts(nuevosContadores);
        setError(null);
      } catch (e) {
        if (!cancelado)
          setError(`No se pudieron cargar las tareas: ${e.message}`);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargar();
    const desuscribir = window.taskAPI.onDataChanged(cargar);
    return () => {
      cancelado = true;
      desuscribir();
    };
  }, [filter]);

  // El popup quick-add no muestra la lista, pero necesita las categorías para
  // interpretar los #tokens del input.
  useEffect(() => {
    if (!isQuickAdd) return;
    window.taskAPI
      .getCategories()
      .then(setCategories)
      .catch((e) =>
        setError(`No se pudieron cargar las categorías: ${e.message}`),
      );
  }, []);

  // Envuelve una mutación para que un fallo se vea en pantalla en vez de dejar
  // una promesa rechazada sin atender y la interfaz muda.
  const mutar = useCallback(async (accion, mensaje) => {
    try {
      setError(null);
      return await accion();
    } catch (e) {
      setError(`${mensaje}: ${e.message}`);
      return null;
    }
  }, []);

  const handleToggle = (id) =>
    mutar(async () => {
      await window.taskAPI.toggleTask(id);
      if (selectedTask?.id === id) setSelectedTask(null);
    }, "No se pudo cambiar el estado de la tarea");

  const handleDelete = (id) =>
    mutar(async () => {
      await window.taskAPI.deleteTask(id);
      if (selectedTask?.id === id) setSelectedTask(null);
    }, "No se pudo eliminar la tarea");

  const handleCreate = (task) =>
    mutar(() => window.taskAPI.createTask(task), "No se pudo crear la tarea");

  const handleUpdate = (id, data) =>
    mutar(async () => {
      const actualizada = await window.taskAPI.updateTask(id, data);
      setSelectedTask(actualizada);
    }, "No se pudo guardar la tarea");

  const handleCreateCategory = (name, color) =>
    mutar(
      () => window.taskAPI.createCategory(name, color),
      "No se pudo crear la categoría",
    );

  if (isQuickAdd)
    return <QuickAdd onSave={handleCreate} categories={categories} />;

  return (
    <div className="flex flex-col h-screen bg-base text-white overflow-hidden select-none">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-2 bg-red-500/15 border-b border-red-500/25 text-xs text-red-300 shrink-0"
        >
          <AlertTriangle size={13} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300/60 hover:text-red-300"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          filter={filter}
          setFilter={(f) => {
            setFilter(f);
            setSelectedTask(null);
          }}
          categories={categories}
          counts={counts}
          onCreateCategory={handleCreateCategory}
        />

        <TaskList
          tasks={tasks}
          loading={loading}
          filter={filter}
          onToggle={handleToggle}
          onSelect={setSelectedTask}
          selectedId={selectedTask?.id}
          onQuickCreate={handleCreate}
          categories={categories}
        />

        {/* La `key` remonta el panel al cambiar de tarea, y con él su estado
            interno. Es lo que sustituye al useEffect que copiaba props a estado. */}
        {selectedTask && (
          <TaskDetail
            key={selectedTask.id}
            task={selectedTask}
            categories={categories}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </div>
    </div>
  );
}
