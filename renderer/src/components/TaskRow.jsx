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
      className={`task-enter w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
        seleccionada
          ? "bg-indigo-500/15 border-indigo-500/30"
          : "bg-white/3 border-transparent hover:bg-white/6 hover:border-white/8"
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
        className="shrink-0 transition-all hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded-full"
      >
        {task.completed ? (
          <CheckCircle2 size={18} className="text-indigo-400" />
        ) : (
          <Circle size={18} className="text-white/25 hover:text-indigo-400" />
        )}
      </span>

      <span className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${
            task.completed ? "line-through text-white/30" : "text-white/85"
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
            className="w-1.5 h-1.5 rounded-full"
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
