import { Plus } from "lucide-react";
import { ChipRow } from "../Chip";

/** Modo "Tarea": una línea con la sintaxis rápida y Enter para guardar. */
export default function QuickAddTask({
  valor,
  onChange,
  parsed,
  onGuardar,
  inputRef,
}) {
  return (
    <div className="flex-1 flex flex-col px-4 min-h-0">
      <div className="flex-1 flex items-center gap-3">
        <Plus size={18} className="text-indigo-400 shrink-0" />
        <input
          ref={inputRef}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onGuardar()}
          aria-label="Nueva tarea"
          placeholder="¿Qué tienes en mente?"
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
        />
      </div>
      <ChipRow chips={parsed.chips} className="pb-1.5 shrink-0" />
    </div>
  );
}
