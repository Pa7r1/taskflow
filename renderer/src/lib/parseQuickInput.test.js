import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import parseQuickInput, { normalize } from "./parseQuickInput";

// Jueves 6 de agosto de 2026, mediodía. Ver dates.test.js para el porqué de esta fecha.
const HOY = new Date(2026, 7, 6, 12, 0, 0);

const CATEGORIAS = [
  { id: 1, name: "Trabajo", color: "#f59e0b" },
  { id: 2, name: "Diseño", color: "#10b981" },
  { id: 3, name: "Ideas Sueltas", color: "#6366f1" },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("normalize", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalize("Diseño Gráfico")).toBe("diseno grafico");
  });

  it("deja intacto un texto que ya está normalizado", () => {
    expect(normalize("trabajo")).toBe("trabajo");
  });
});

describe("parseQuickInput — texto sin tokens", () => {
  it("devuelve el texto como título y los valores por defecto", () => {
    const r = parseQuickInput("Comprar pan", CATEGORIAS);
    expect(r).toMatchObject({
      title: "Comprar pan",
      priority: "normal",
      category_id: null,
      due_date: null,
      chips: [],
    });
  });

  it("con texto vacío devuelve un título vacío", () => {
    expect(parseQuickInput("", CATEGORIAS).title).toBe("");
  });

  it("con solo espacios devuelve un título vacío", () => {
    expect(parseQuickInput("     ", CATEGORIAS).title).toBe("");
  });

  it("colapsa los espacios de más entre palabras", () => {
    expect(parseQuickInput("Comprar    pan", CATEGORIAS).title).toBe(
      "Comprar pan",
    );
  });

  it("funciona sin pasarle categorías", () => {
    expect(parseQuickInput("Comprar pan").title).toBe("Comprar pan");
  });
});

describe("parseQuickInput — prioridad", () => {
  it("interpreta !alta como prioridad alta y la saca del título", () => {
    const r = parseQuickInput("!alta Llamar al banco", CATEGORIAS);
    expect(r.priority).toBe("high");
    expect(r.title).toBe("Llamar al banco");
    expect(r.chips).toContainEqual({
      type: "priority",
      label: "Prioridad alta",
    });
  });

  it("interpreta !baja como prioridad baja", () => {
    const r = parseQuickInput("!baja Ordenar cajones", CATEGORIAS);
    expect(r.priority).toBe("low");
    expect(r.title).toBe("Ordenar cajones");
  });

  it("reconoce la prioridad en mayúsculas y con acento del texto alrededor", () => {
    expect(parseQuickInput("!ALTA Revisión", CATEGORIAS).priority).toBe("high");
  });

  it("reconoce la prioridad esté donde esté, no solo al principio", () => {
    const r = parseQuickInput("Llamar al banco !alta", CATEGORIAS);
    expect(r.priority).toBe("high");
    expect(r.title).toBe("Llamar al banco");
  });

  it("ignora un token de prioridad que no existe y lo deja en el título", () => {
    const r = parseQuickInput("!urgente Llamar", CATEGORIAS);
    expect(r.priority).toBe("normal");
    expect(r.title).toBe("!urgente Llamar");
  });

  it("con dos prioridades, gana la última escrita", () => {
    const r = parseQuickInput("!alta !baja Tarea", CATEGORIAS);
    expect(r.priority).toBe("low");
    expect(r.chips.filter((c) => c.type === "priority")).toHaveLength(2);
  });
});

describe("parseQuickInput — categoría", () => {
  it("asocia #categoria con la categoría existente y la saca del título", () => {
    const r = parseQuickInput("#trabajo Enviar informe", CATEGORIAS);
    expect(r.category_id).toBe(1);
    expect(r.title).toBe("Enviar informe");
    expect(r.chips).toContainEqual({
      type: "category",
      label: "Trabajo",
      color: "#f59e0b",
    });
  });

  it("no distingue mayúsculas", () => {
    expect(parseQuickInput("#TRABAJO Informe", CATEGORIAS).category_id).toBe(1);
  });

  it("no distingue acentos, en ninguna de las dos direcciones", () => {
    expect(parseQuickInput("#diseño Maqueta", CATEGORIAS).category_id).toBe(2);
    expect(parseQuickInput("#diseno Maqueta", CATEGORIAS).category_id).toBe(2);
  });

  it("deja en el título una categoría que no existe", () => {
    const r = parseQuickInput("#inexistente Comprar", CATEGORIAS);
    expect(r.category_id).toBeNull();
    expect(r.title).toBe("#inexistente Comprar");
    expect(r.chips).toHaveLength(0);
  });

  it("trata una almohadilla suelta como parte del título", () => {
    expect(parseQuickInput("# Comprar", CATEGORIAS).title).toBe("# Comprar");
  });

  it("no puede reconocer categorías cuyo nombre lleva espacios", () => {
    // Limitación conocida: el texto se parte por espacios, así que "#Ideas Sueltas"
    // nunca coincidirá con la categoría de ese nombre.
    const r = parseQuickInput("#ideas sueltas Anotar", CATEGORIAS);
    expect(r.category_id).toBeNull();
    expect(r.title).toBe("#ideas sueltas Anotar");
  });
});

describe("parseQuickInput — fechas relativas", () => {
  it.each([
    ["hoy", "2026-08-06"],
    ["mañana", "2026-08-07"],
    ["manana", "2026-08-07"],
    ["HOY", "2026-08-06"],
  ])("interpreta '%s' como %s", (texto, esperado) => {
    expect(parseQuickInput(`${texto} Comprar`, CATEGORIAS).due_date).toBe(
      esperado,
    );
  });

  it("interpreta 'pasado mañana' como dentro de dos días y consume las dos palabras", () => {
    const r = parseQuickInput("pasado mañana Comprar", CATEGORIAS);
    expect(r.due_date).toBe("2026-08-08");
    expect(r.title).toBe("Comprar");
  });

  it("deja 'pasado' en el título si no le sigue 'mañana'", () => {
    const r = parseQuickInput("pasado Comprar", CATEGORIAS);
    expect(r.due_date).toBeNull();
    expect(r.title).toBe("pasado Comprar");
  });
});

describe("parseQuickInput — días de la semana", () => {
  // Hoy es jueves 6 de agosto de 2026.
  it.each([
    ["viernes", "2026-08-07"],
    ["sabado", "2026-08-08"],
    ["sábado", "2026-08-08"],
    ["domingo", "2026-08-09"],
    ["lunes", "2026-08-10"],
    ["martes", "2026-08-11"],
    ["miercoles", "2026-08-12"],
    ["miércoles", "2026-08-12"],
  ])("interpreta '%s' como el próximo %s", (dia, esperado) => {
    expect(parseQuickInput(`${dia} Comprar`, CATEGORIAS).due_date).toBe(
      esperado,
    );
  });

  it("nombrar el día de hoy apunta a la semana que viene, nunca a hoy", () => {
    expect(parseQuickInput("jueves Comprar", CATEGORIAS).due_date).toBe(
      "2026-08-13",
    );
  });
});

describe("parseQuickInput — fechas dd/mm", () => {
  it("interpreta una fecha futura de este año", () => {
    expect(parseQuickInput("20/08 Comprar", CATEGORIAS).due_date).toBe(
      "2026-08-20",
    );
  });

  it("acepta también el guion como separador", () => {
    expect(parseQuickInput("20-08 Comprar", CATEGORIAS).due_date).toBe(
      "2026-08-20",
    );
  });

  it("acepta el día y el mes sin cero delante", () => {
    expect(parseQuickInput("9/9 Comprar", CATEGORIAS).due_date).toBe(
      "2026-09-09",
    );
  });

  it("salta al año siguiente si la fecha ya pasó este año", () => {
    expect(parseQuickInput("01/03 Comprar", CATEGORIAS).due_date).toBe(
      "2027-03-01",
    );
  });

  it("interpreta el día de hoy escrito como dd/mm, sin saltar de año", () => {
    expect(parseQuickInput("06/08 Comprar", CATEGORIAS).due_date).toBe(
      "2026-08-06",
    );
  });

  it.each(["31/02", "45/13", "00/01"])(
    "descarta la fecha inválida %s y la deja en el título",
    (fecha) => {
      const r = parseQuickInput(`${fecha} Comprar`, CATEGORIAS);
      expect(r.due_date).toBeNull();
      expect(r.title).toBe(`${fecha} Comprar`);
    },
  );

  it("acepta el 29 de febrero de un año bisiesto", () => {
    // Desde agosto de 2026, el próximo 29 de febrero válido es el de 2028.
    vi.setSystemTime(new Date(2028, 0, 10, 12, 0, 0));
    expect(parseQuickInput("29/02 Comprar", CATEGORIAS).due_date).toBe(
      "2028-02-29",
    );
  });
});

describe("parseQuickInput — combinaciones", () => {
  it("interpreta prioridad, categoría y fecha a la vez", () => {
    const r = parseQuickInput(
      "!alta #trabajo mañana Enviar el informe",
      CATEGORIAS,
    );
    expect(r).toMatchObject({
      title: "Enviar el informe",
      priority: "high",
      category_id: 1,
      due_date: "2026-08-07",
    });
    expect(r.chips).toHaveLength(3);
  });

  it("reconoce los tokens en cualquier orden y entre las palabras del título", () => {
    const r = parseQuickInput(
      "Enviar #trabajo el !alta informe mañana",
      CATEGORIAS,
    );
    expect(r).toMatchObject({
      title: "Enviar el informe",
      priority: "high",
      category_id: 1,
      due_date: "2026-08-07",
    });
  });

  it("solo toma la primera fecha; la segunda se queda en el título", () => {
    const r = parseQuickInput("hoy mañana Comprar", CATEGORIAS);
    expect(r.due_date).toBe("2026-08-06");
    expect(r.title).toBe("mañana Comprar");
  });

  it("genera los chips en el orden en que aparecen los tokens", () => {
    const r = parseQuickInput("#trabajo !alta hoy Tarea", CATEGORIAS);
    expect(r.chips.map((c) => c.type)).toEqual([
      "category",
      "priority",
      "date",
    ]);
  });

  it("describe la fecha del chip en lenguaje relativo", () => {
    const r = parseQuickInput("mañana Comprar", CATEGORIAS);
    expect(r.chips).toContainEqual({ type: "date", label: "mañana" });
  });

  it("puede dejar el título vacío si el texto es solo tokens", () => {
    const r = parseQuickInput("!alta #trabajo hoy", CATEGORIAS);
    expect(r.title).toBe("");
    expect(r.chips).toHaveLength(3);
  });
});
