import { useMemo, useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import parseQuickInput from "../lib/parseQuickInput";
import { ChipRow } from "./Chip";
import TaskRow from "./TaskRow";
import TaskOverview from "./TaskOverview";

function ListaVacia() {
  return (
    <div className="flex flex-col items-center justify-center h-44 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] text-white/25">
      <CheckCircle2 size={34} className="mb-3 text-indigo-300/35" />
      <p className="text-sm font-medium text-white/45">Sin tareas por aquí</p>
      <p className="mt-1 text-xs text-white/30">
        Usá la captura rápida o el input superior.
      </p>
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
  filter,
  counts,
  listFocusRef,
  detailOpen,
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
    <main
      ref={listFocusRef}
      tabIndex={-1}
      className={`flex-1 flex-col min-w-0 overflow-hidden focus:outline-none ${
        detailOpen ? "hidden lg:flex" : "flex"
      }`}
    >
      <TaskOverview
        filter={filter}
        categories={categories}
        listCount={tasks.length}
        counts={counts}
      />

      <div className="px-5 pb-4 lg:px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] group focus-within:border-indigo-400/45 focus-within:bg-white/[0.07]">
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

      <div
        data-smoke="task-list"
        className="flex-1 overflow-y-auto px-5 pb-5 lg:px-6 lg:pb-6 flex flex-col gap-1.5"
      >
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
