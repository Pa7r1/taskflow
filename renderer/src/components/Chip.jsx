// Etiqueta de lo que la sintaxis rápida detectó en el input: prioridad, fecha o
// categoría. La usan tanto el input de la lista como el popup de captura rápida.

const ESTILOS = {
  "priority-high": "bg-red-500/20 text-red-400",
  "priority-normal": "bg-white/10 text-white/50",
  date: "bg-indigo-500/20 text-indigo-300",
  category: "text-white",
};

function claseDe(chip) {
  if (chip.type === "priority")
    return ESTILOS[
      chip.label === "Prioridad alta" ? "priority-high" : "priority-normal"
    ];
  return ESTILOS[chip.type] ?? "";
}

export default function Chip({ chip }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full ${claseDe(chip)}`}
      // El color de una categoría lo define el usuario, así que no puede salir
      // de una clase de Tailwind: va inline a propósito.
      style={
        chip.type === "category"
          ? { backgroundColor: `${chip.color}40`, color: chip.color }
          : undefined
      }
    >
      {chip.label}
    </span>
  );
}

/** Fila de chips bajo un input. Se encoge a nada si no hay ninguno. */
export function ChipRow({ chips, className = "" }) {
  if (chips.length === 0) return null;
  return (
    <div className={`flex gap-1.5 ${className}`}>
      {chips.map((chip) => (
        <Chip key={`${chip.type}-${chip.label}`} chip={chip} />
      ))}
    </div>
  );
}
