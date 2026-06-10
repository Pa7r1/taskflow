import { useState, useEffect } from "react";
import { X, Trash2, Bell, Calendar, Tag, FileText } from "lucide-react";

export default function TaskDetail({
  task,
  categories,
  onUpdate,
  onDelete,
  onClose,
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const [priority, setPriority] = useState(task.priority || "normal");
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [categoryId, setCategoryId] = useState(task.category_id || "");
  const [reminderAt, setReminderAt] = useState(task.reminder_at || "");

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes || "");
    setPriority(task.priority || "normal");
    setDueDate(task.due_date || "");
    setCategoryId(task.category_id || "");
    setReminderAt(task.reminder_at || "");
  }, [task.id]);

  const save = (overrides = {}) =>
    onUpdate(task.id, {
      title,
      notes,
      priority,
      due_date: dueDate || null,
      category_id: categoryId || null,
      reminder_at: reminderAt || null,
      ...overrides,
    });

  return (
    <aside className="w-80 bg-[#13131a] border-l border-white/5 flex flex-col p-6 gap-5 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/30 uppercase tracking-wider">
          Detalle
        </span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Title */}
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        rows={2}
        className="bg-transparent text-white text-base font-medium resize-none outline-none placeholder-white/20 leading-relaxed"
        placeholder="Título de la tarea"
      />

      {/* Notes */}
      <div>
        <label className="text-xs text-white/30 mb-2 flex items-center gap-1.5">
          <FileText size={12} /> Notas
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          rows={6}
          placeholder="Notas, ideas, contexto..."
          className="w-full min-h-32 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/75 placeholder-white/25 resize-y outline-none leading-relaxed transition-all focus:border-indigo-500/40 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/10"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="text-xs text-white/30 mb-2 block">Prioridad</label>
        <div className="flex gap-2">
          {["low", "normal", "high"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPriority(p);
                save({ priority: p });
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs capitalize transition-all ${
                priority === p
                  ? p === "high"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : p === "low"
                      ? "bg-white/5 text-white/40 border border-white/10"
                      : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-white/3 text-white/30 hover:bg-white/8 border border-transparent"
              }`}
            >
              {p === "low" ? "Baja" : p === "normal" ? "Normal" : "Alta"}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="text-xs text-white/30 mb-2 flex items-center gap-1.5">
          <Tag size={12} /> Categoría
        </label>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            save({ category_id: e.target.value || null });
          }}
          className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Due date */}
      <div>
        <label className="text-xs text-white/30 mb-2 flex items-center gap-1.5">
          <Calendar size={12} /> Fecha límite
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => {
            setDueDate(e.target.value);
            save({ due_date: e.target.value || null });
          }}
          className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/60 outline-none"
        />
      </div>

      {/* Reminder */}
      <div>
        <label className="text-xs text-white/30 mb-2 flex items-center gap-1.5">
          <Bell size={12} /> Recordatorio
        </label>
        <input
          type="datetime-local"
          value={reminderAt}
          onChange={(e) => {
            setReminderAt(e.target.value);
            save({ reminder_at: e.target.value || null });
          }}
          className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/60 outline-none"
        />
        <p className="text-[10px] text-white/25 mt-1.5">
          Se programa automáticamente al elegir fecha y hora
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="mt-auto flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
      >
        <Trash2 size={13} /> Eliminar tarea
      </button>
    </aside>
  );
}
