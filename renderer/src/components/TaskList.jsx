import { useMemo, useState } from "react";
import { Plus, Circle, CheckCircle2, Star } from "lucide-react";
import parseQuickInput from "../lib/parseQuickInput";
import { formatRelative, isOverdue } from "../lib/dates";

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
    if (e.key === "Enter" && parsed.title.trim()) {
      await onQuickCreate({
        title: parsed.title.trim(),
        notes: "",
        priority: parsed.priority,
        category_id: parsed.category_id,
        due_date: parsed.due_date,
        reminder_at: null,
      });
      setInput("");
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Quick input */}
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
            placeholder="Agregar tarea... (#categoría !alta mañana)"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
          />
        </div>
        {parsed.chips.length > 0 && (
          <div className="flex gap-1.5 mt-2 px-1">
            {parsed.chips.map((chip, i) => (
              <span
                key={i}
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  chip.type === "date"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : chip.type === "priority"
                      ? chip.label === "Prioridad alta"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 text-white/50"
                      : ""
                }`}
                style={
                  chip.type === "category"
                    ? { backgroundColor: `${chip.color}40`, color: chip.color }
                    : undefined
                }
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-1">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/20">
            <CheckCircle2 size={32} className="mb-3" />
            <p className="text-sm">Sin tareas por aquí</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onSelect(task)}
              className={`task-enter flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                selectedId === task.id
                  ? "bg-indigo-500/15 border-indigo-500/30"
                  : "bg-white/3 border-transparent hover:bg-white/6 hover:border-white/8"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(task.id);
                }}
                className="shrink-0 transition-all hover:scale-110"
              >
                {task.completed ? (
                  <CheckCircle2 size={18} className="text-indigo-400" />
                ) : (
                  <Circle
                    size={18}
                    className="text-white/25 hover:text-indigo-400"
                  />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm truncate ${task.completed ? "line-through text-white/30" : "text-white/85"}`}
                >
                  {task.title}
                </p>
                {task.due_date && (
                  <p
                    className={`text-xs mt-0.5 ${
                      !task.completed && isOverdue(task.due_date)
                        ? "text-red-400"
                        : "text-white/30"
                    }`}
                  >
                    {formatRelative(task.due_date)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {task.category_color && (
                  <span
                    style={{ backgroundColor: task.category_color }}
                    className="w-1.5 h-1.5 rounded-full"
                  />
                )}
                {task.priority === "high" && (
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
