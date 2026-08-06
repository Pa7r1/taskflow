const MAX_TITULO = 60;

/**
 * Convierte un texto libre en una tarea: la primera línea es el título y el
 * resto son las notas.
 *
 * Si la primera línea pasa de 60 caracteres, el título se recorta pero el texto
 * completo se conserva en las notas — así no se pierde nada de lo escrito.
 *
 * @returns {{ title: string, notes: string } | null} null si no hay contenido.
 */
export default function parseBlankNote(texto) {
  const limpio = (texto ?? "").trim();
  if (!limpio) return null;

  // Tras el trim, la primera línea siempre tiene contenido: no hace falta un
  // título de reserva.
  const [primeraLinea, ...resto] = limpio.split("\n");
  const primera = primeraLinea.trim();

  return {
    title: primera.slice(0, MAX_TITULO),
    notes: primera.length > MAX_TITULO ? limpio : resto.join("\n").trim(),
  };
}
