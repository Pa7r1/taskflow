import { useMemo } from "react";
import { X, Link2 } from "lucide-react";
import { normalize } from "../../lib/parseQuickInput";

const MAX_SUGERENCIAS = 4;
const MIN_LETRAS_PARA_BUSCAR = 2;

/**
 * Modo "Nota con título": o crea una tarea nueva con notas, o busca una tarea
 * existente para anexarle la nota.
 */
export default function QuickAddNote({
  titulo,
  onTituloChange,
  cuerpo,
  onCuerpoChange,
  tareaElegida,
  onElegirTarea,
  tareasPendientes,
  onGuardar,
  tituloRef,
  cuerpoRef,
}) {
  const sugerencias = useMemo(() => {
    const termino = normalize(titulo.trim());
    if (!termino || termino.length < MIN_LETRAS_PARA_BUSCAR || tareaElegida)
      return [];
    return tareasPendientes
      .filter((t) => normalize(t.title).includes(termino))
      .slice(0, MAX_SUGERENCIAS);
  }, [titulo, tareasPendientes, tareaElegida]);

  return (
    <div className="flex-1 flex flex-col gap-2 px-4 py-2 min-h-0">
      {tareaElegida ? (
        <div className="flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/25 rounded-lg px-3 py-1.5 text-xs text-indigo-300 shrink-0">
          <Link2 size={12} className="shrink-0" />
          <span className="truncate flex-1">
            Anexar a: {tareaElegida.title}
          </span>
          <button
            onClick={() => onElegirTarea(null)}
            aria-label="Dejar de anexar"
            className="text-indigo-300/60 hover:text-indigo-300 shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="relative shrink-0">
          <input
            ref={tituloRef}
            value={titulo}
            onChange={(e) => onTituloChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cuerpoRef.current?.focus()}
            aria-label="Título de la nota o búsqueda de tarea"
            placeholder="Título nuevo o buscar tarea existente..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder-white/30 focus:border-indigo-500/40"
          />
          {sugerencias.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-elevated border border-white/10 rounded-lg overflow-hidden shadow-xl">
              {sugerencias.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onElegirTarea(t)}
                  className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-indigo-500/20 hover:text-white truncate"
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <textarea
        ref={cuerpoRef}
        value={cuerpo}
        onChange={(e) => onCuerpoChange(e.target.value)}
        onKeyDown={(e) =>
          (e.ctrlKey || e.metaKey) && e.key === "Enter" && onGuardar()
        }
        aria-label="Cuerpo de la nota"
        placeholder="Escribe la nota, detalles, contexto..."
        className="flex-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none placeholder-white/25 resize-none leading-relaxed focus:border-indigo-500/40"
      />
    </div>
  );
}
