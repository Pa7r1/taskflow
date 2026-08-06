import { useMemo, useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import parseQuickInput from "../lib/parseQuickInput";
import { ChipRow } from "./Chip";
import TaskRow from "./TaskRow";

function ListaVacia() {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-white/20">
      <CheckCircle2 size={32} className="mb-3" />
      <p className="text-sm">Sin tareas por aquí</p>
    </div>
  );
}

function Cargando() {
  return (
    <div className="flex items-center justify-center h-40">
      <div
        role="status"
        aria-label="Cargando tareas"
        className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"
      />
    </div>
  );
}

export default function TaskList({
  tasks,
  loading,
  onToggle,
  onSelect,
  selectedId,
  onQuickCreate,
  categories,
}) {
  const [input, setInput] = useState("");

  const parsed = useMemo(
    () => parseQuickInput(input, categories),
    [input, categories],
  );

  const handleKeyDown = async (e) => {
    if (e.key !== "Enter" || !parsed.title.trim()) return;
    const creada = await onQuickCreate({
      title: parsed.title.trim(),
      notes: "",
      priority: parsed.priority,
      category_id: parsed.category_id,
      due_date: parsed.due_date,
      reminder_at: null,
    });
    // Solo se vacía el input si de verdad se guardó: si falló, no se pierde
    // lo escrito.
    if (creada) setInput("");
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="px-6 pt-10 pb-4">
        <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 group focus-within:border-indigo-500/40">
          <Plus
            size={16}
            className="text-white/30 group-focus-within:text-indigo-400 transition-colors"
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Agregar tarea"
            placeholder="Agregar tarea... (#categoría !alta mañana)"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
          />
        </div>
        <ChipRow chips={parsed.chips} className="mt-2 px-1" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-1">
        {loading ? (
          <Cargando />
        ) : tasks.length === 0 ? (
          <ListaVacia />
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              seleccionada={selectedId === task.id}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </main>
  );
}
