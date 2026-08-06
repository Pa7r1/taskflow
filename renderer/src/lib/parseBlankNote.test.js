import { describe, it, expect } from "vitest";
import parseBlankNote from "./parseBlankNote";

const LARGO = "a".repeat(80);

describe("parseBlankNote", () => {
  it("usa la primera línea como título y el resto como notas", () => {
    expect(parseBlankNote("Comprar pan\ny leche\ny huevos")).toEqual({
      title: "Comprar pan",
      notes: "y leche\ny huevos",
    });
  });

  it("con una sola línea deja las notas vacías", () => {
    expect(parseBlankNote("Comprar pan")).toEqual({
      title: "Comprar pan",
      notes: "",
    });
  });

  it("devuelve null si no hay contenido", () => {
    expect(parseBlankNote("")).toBeNull();
    expect(parseBlankNote("   \n  \n ")).toBeNull();
    expect(parseBlankNote(null)).toBeNull();
  });

  it("recorta el título a 60 caracteres", () => {
    expect(parseBlankNote(LARGO).title).toHaveLength(60);
  });

  it("conserva el texto completo en las notas cuando el título se recortó", () => {
    // Si no, los 20 caracteres que sobran se perderían sin avisar.
    const { notes } = parseBlankNote(LARGO);
    expect(notes).toBe(LARGO);
  });

  it("no mete el texto en las notas si el título cabía entero", () => {
    expect(parseBlankNote("Corto").notes).toBe("");
  });

  it("descarta los saltos de línea iniciales al elegir el título", () => {
    // El trim inicial hace que la primera línea nunca quede vacía, que es por
    // lo que la función no necesita un título de reserva.
    expect(parseBlankNote("\n\nsolo cuerpo")).toEqual({
      title: "solo cuerpo",
      notes: "",
    });
  });

  it("ignora los espacios sobrantes alrededor", () => {
    expect(parseBlankNote("  Título  \n  cuerpo  ")).toEqual({
      title: "Título",
      notes: "cuerpo",
    });
  });
});
