import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toISODate, isOverdue, formatRelative, formatAbsolute } from "./dates";

// Jueves 6 de agosto de 2026, mediodía. Elegido a propósito:
// - al ser jueves, quedan días de la semana por delante y por detrás dentro de la misma semana;
// - agosto está a mitad de año, así que hay meses pasados y futuros con los que probar el salto de año.
const HOY = new Date(2026, 7, 6, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toISODate", () => {
  it("formatea una fecha como aaaa-mm-dd", () => {
    expect(toISODate(new Date(2026, 7, 6))).toBe("2026-08-06");
  });

  it("rellena con cero el mes y el día de una cifra", () => {
    expect(toISODate(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("usa la fecha local, no la UTC", () => {
    // A las 23:00 hora local, el instante en UTC puede caer ya en el día siguiente
    // (o el anterior). toISODate debe devolver siempre el día que ve el usuario.
    expect(toISODate(new Date(2026, 7, 6, 23, 30))).toBe("2026-08-06");
    expect(toISODate(new Date(2026, 7, 6, 0, 30))).toBe("2026-08-06");
  });

  it("respeta el último día de un año bisiesto", () => {
    expect(toISODate(new Date(2024, 1, 29))).toBe("2024-02-29");
  });
});

describe("isOverdue", () => {
  it("considera vencida una fecha anterior a hoy", () => {
    expect(isOverdue("2026-08-05")).toBe(true);
  });

  it("no considera vencido el día de hoy", () => {
    expect(isOverdue("2026-08-06")).toBe(false);
  });

  it("no considera vencida una fecha futura", () => {
    expect(isOverdue("2026-08-07")).toBe(false);
  });

  it("compara por día, no por hora: sigue sin estar vencida a última hora del día", () => {
    vi.setSystemTime(new Date(2026, 7, 6, 23, 59, 59));
    expect(isOverdue("2026-08-06")).toBe(false);
  });
});

describe("formatAbsolute", () => {
  it("da día y mes abreviado", () => {
    const resultado = formatAbsolute("2026-08-03");
    expect(resultado).toContain("3");
    expect(resultado).toMatch(/ago/i);
  });

  it("no depende del día de hoy", () => {
    const desdeAgosto = formatAbsolute("2026-03-15");
    vi.setSystemTime(new Date(2027, 5, 1));
    expect(formatAbsolute("2026-03-15")).toBe(desdeAgosto);
  });

  it("devuelve la cadena tal cual si no es una fecha válida", () => {
    expect(formatAbsolute("cualquier-cosa")).toBe("cualquier-cosa");
  });
});

describe("formatRelative", () => {
  it.each([
    ["2026-08-06", "hoy"],
    ["2026-08-07", "mañana"],
    ["2026-08-05", "ayer"],
  ])("describe %s como '%s'", (fecha, esperado) => {
    expect(formatRelative(fecha)).toBe(esperado);
  });

  it("cuenta los días transcurridos para el pasado reciente", () => {
    expect(formatRelative("2026-08-03")).toBe("hace 3 días");
  });

  it("cuenta los días que faltan dentro de la próxima semana", () => {
    expect(formatRelative("2026-08-11")).toBe("en 5 días");
    expect(formatRelative("2026-08-13")).toBe("en 7 días");
  });

  it("a partir de 8 días muestra la fecha corta en vez de los días", () => {
    const resultado = formatRelative("2026-08-14");
    expect(resultado).not.toMatch(/días/);
    expect(resultado).toContain("14");
  });

  it("describe un pasado lejano con los días transcurridos, sin límite", () => {
    expect(formatRelative("2026-06-06")).toBe("hace 61 días");
  });

  it("devuelve la cadena tal cual si no es una fecha válida", () => {
    expect(formatRelative("no-es-una-fecha")).toBe("no-es-una-fecha");
  });

  it("cruza el cambio de año sin perder la cuenta", () => {
    vi.setSystemTime(new Date(2026, 11, 31, 12, 0, 0));
    expect(formatRelative("2027-01-01")).toBe("mañana");
    expect(formatRelative("2026-12-30")).toBe("ayer");
  });

  it("no se descuadra con el cambio de horario de verano", () => {
    // En España el cambio de hora de octubre de 2026 cae el domingo 25.
    // Si el cálculo usara horas en vez de días, aquí aparecería un desfase.
    vi.setSystemTime(new Date(2026, 9, 24, 12, 0, 0));
    expect(formatRelative("2026-10-25")).toBe("mañana");
    expect(formatRelative("2026-10-26")).toBe("en 2 días");
  });
});
