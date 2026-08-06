/** Modo "Nota en blanco": texto libre; la primera línea será el título. */
export default function QuickAddBlank({
  valor,
  onChange,
  onGuardar,
  inputRef,
}) {
  return (
    <textarea
      ref={inputRef}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) =>
        (e.ctrlKey || e.metaKey) && e.key === "Enter" && onGuardar()
      }
      aria-label="Nota en blanco"
      placeholder={
        "Escribe libremente...\nLa primera línea será el título de la nota."
      }
      className="flex-1 mx-4 my-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none placeholder-white/25 resize-none leading-relaxed focus:border-indigo-500/40"
    />
  );
}
