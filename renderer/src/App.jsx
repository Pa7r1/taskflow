import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import TaskList from "./components/TaskList";
import TaskDetail from "./components/TaskDetail";
import QuickAdd from "./components/QuickAdd";

const isQuickAdd =
  new URLSearchParams(window.location.search).get("mode") === "quickadd";

export default function App() {
  const [filter, setFilter] = useState("today");
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTasks = async (f = filter) => {
    const data = await window.taskAPI.getTasks(f);
    setTasks(data);
    setLoading(false);
  };

  const loadCategories = async () => {
    const data = await window.taskAPI.getCategories();
    setCategories(data);
  };

  const filterRef = useRef(filter);
  filterRef.current = filter;

  useEffect(() => {
    loadCategories();
    if (!isQuickAdd) loadTasks();
  }, [filter]);

  // Refresco en vivo: cuando otra ventana (p. ej. el popup quick-add) muta
  // datos, el proceso main emite data:changed y acá se vuelve a consultar.
  // Se suscribe una sola vez; el filtro vigente se lee del ref.
  useEffect(() => {
    if (isQuickAdd) return;
    window.taskAPI.onDataChanged(() => {
      loadTasks(filterRef.current);
      loadCategories();
    });
  }, []);

  const handleToggle = async (id) => {
    await window.taskAPI.toggleTask(id);
    loadTasks();
    if (selectedTask?.id === id) setSelectedTask(null);
  };

  const handleDelete = async (id) => {
    await window.taskAPI.deleteTask(id);
    loadTasks();
    if (selectedTask?.id === id) setSelectedTask(null);
  };

  const handleCreate = async (task) => {
    await window.taskAPI.createTask(task);
    loadTasks();
  };

  const handleUpdate = async (id, data) => {
    const updated = await window.taskAPI.updateTask(id, data);
    setSelectedTask(updated);
    loadTasks();
  };

  if (isQuickAdd)
    return <QuickAdd onSave={handleCreate} categories={categories} />;

  return (
    <div className="flex h-screen bg-[#0f0f13] text-white overflow-hidden select-none">
      <Sidebar
        filter={filter}
        setFilter={(f) => {
          setFilter(f);
          setSelectedTask(null);
        }}
        categories={categories}
        tasks={tasks}
        onNewCategory={loadCategories}
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

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          categories={categories}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
