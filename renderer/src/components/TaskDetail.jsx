import { useState } from "react";
import { X, Trash2, Bell, Calendar, Tag, FileText } from "lucide-react";

const PRIORIDADES = [
  {
    id: "high",
    label: "Alta",
    activo: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  {
    id: "normal",
    label: "Normal",
    activo: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  },
  {
    id: "low",
    label: "Baja",
    activo: "bg-white/5 text-white/40 border-white/10",
  },
];

const CAMPO =
  "w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/60 outline-none focus:border-indigo-500/40";

function Etiqueta({ icon: Icon, children }) {
  return (
    <span className="text-xs text-white/30 mb-2 flex items-center gap-1.5">
      {Icon && <Icon size={12} />} {children}
    </span>
  );
}

/**
 * Panel de detalle de una tarea.
 *
 * El estado se inicializa desde la tarea y NO se resincroniza con un efecto: el
 * padre monta este componente con `key={task.id}`, así que cambiar de tarea lo
 * remonta y el estado arranca limpio. Copiar props a estado con un `useEffect`
 * era el antipatrón que había aquí antes.
 */
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

  // Los campos de texto guardan al perder el foco; los selectores, al elegir.
  // `overrides` evita depender de que el estado ya se haya actualizado.
  const guardar = (overrides = {}) =>
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
    <aside className="w-80 bg-panel border-l border-white/5 flex flex-col p-6 gap-5 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/30 uppercase tracking-wider">
          Detalle
        </span>
        <button
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => guardar()}
        rows={2}
        aria-label="Título de la tarea"
        className="bg-transparent text-white text-base font-medium resize-none outline-none placeholder-white/20 leading-relaxed"
        placeholder="Título de la tarea"
      />

      <label>
        <Etiqueta icon={FileText}>Notas</Etiqueta>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => guardar()}
          rows={6}
          placeholder="Notas, ideas, contexto..."
          className="w-full min-h-32 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/75 placeholder-white/25 resize-y outline-none leading-relaxed transition-all focus:border-indigo-500/40 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/10"
        />
      </label>

      <div>
        <Etiqueta>Prioridad</Etiqueta>
        <div className="flex gap-2" role="group" aria-label="Prioridad">
          {PRIORIDADES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPriority(p.id);
                guardar({ priority: p.id });
              }}
              aria-pressed={priority === p.id}
              className={`flex-1 py-1.5 rounded-lg text-xs transition-all border ${
                priority === p.id
                  ? p.activo
                  : "bg-white/3 text-white/30 hover:bg-white/8 border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label>
        <Etiqueta icon={Tag}>Categoría</Etiqueta>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            guardar({ category_id: e.target.value || null });
          }}
          className={CAMPO}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <Etiqueta icon={Calendar}>Fecha límite</Etiqueta>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => {
            setDueDate(e.target.value);
            guardar({ due_date: e.target.value || null });
          }}
          className={CAMPO}
        />
      </label>

      <label>
        <Etiqueta icon={Bell}>Recordatorio</Etiqueta>
        <input
          type="datetime-local"
          value={reminderAt}
          onChange={(e) => {
            setReminderAt(e.target.value);
            guardar({ reminder_at: e.target.value || null });
          }}
          className={CAMPO}
        />
        <span className="block text-[10px] text-white/25 mt-1.5">
          Se programa automáticamente al elegir fecha y hora
        </span>
      </label>

      <button
        onClick={() => onDelete(task.id)}
        className="mt-auto flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
      >
        <Trash2 size={13} /> Eliminar tarea
      </button>
    </aside>
  );
}
