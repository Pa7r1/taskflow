import { Circle, CheckCircle2, Star } from "lucide-react";
import { formatRelative, formatAbsolute, isOverdue } from "../lib/dates";

function FechaLimite({ task }) {
  if (!task.due_date) return null;

  // Vencida: hace falta saber cuánto se pasó Y desde qué día.
  if (!task.completed && isOverdue(task.due_date))
    return (
      <p className="text-xs mt-0.5 text-red-400">
        Venció el {formatAbsolute(task.due_date)} ·{" "}
        {formatRelative(task.due_date)}
      </p>
    );

  return (
    <p className="text-xs mt-0.5 text-white/30">
      {formatRelative(task.due_date)}
    </p>
  );
}

export default function TaskRow({ task, seleccionada, onToggle, onSelect }) {
  return (
    // Un <div> con onClick no se puede enfocar ni activar con el teclado. Es un
    // botón: se usa el elemento nativo, que ya trae foco, Enter y Espacio.
    <button
      type="button"
      onClick={() => onSelect(task)}
      aria-pressed={seleccionada}
      className={`task-enter w-full text-left flex items-start gap-3 rounded-2xl border px-4 py-3.5 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
        seleccionada
          ? "border-indigo-400/45 bg-indigo-500/[0.18] shadow-[inset_3px_0_0_rgba(129,140,248,0.85)]"
          : "border-white/[0.035] bg-white/[0.035] hover:border-white/10 hover:bg-white/[0.065]"
      }`}
    >
      <span
        role="checkbox"
        tabIndex={0}
        aria-checked={Boolean(task.completed)}
        aria-label={
          task.completed ? "Marcar como pendiente" : "Marcar como completada"
        }
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task.id);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          onToggle(task.id);
        }}
        className="mt-0.5 shrink-0 transition-all hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded-full"
      >
        {task.completed ? (
          <CheckCircle2 size={18} className="text-indigo-400" />
        ) : (
          <Circle size={18} className="text-white/25 hover:text-indigo-400" />
        )}
      </span>

      <span className="flex-1 min-w-0">
        <p
          className={`text-[15px] truncate leading-5 ${
            task.completed ? "line-through text-white/30" : "text-white/90"
          }`}
        >
          {task.title}
        </p>
        <FechaLimite task={task} />
      </span>

      <span className="flex items-center gap-2 shrink-0">
        {task.category_color && (
          <span
            style={{ backgroundColor: task.category_color }}
            title={task.category_name}
            className="h-2 w-2 rounded-full ring-2 ring-white/10"
          />
        )}
        {task.priority === "high" && (
          <Star
            size={12}
            aria-label="Prioridad alta"
            className="text-amber-400 fill-amber-400"
          />
        )}
      </span>
    </button>
  );
}
