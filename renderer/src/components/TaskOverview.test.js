import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TaskOverview from "./TaskOverview.jsx";

const categories = [
  { id: 7, name: "Trabajo", color: "#5b8def" },
  { id: 11, name: "Personal", color: "#e07b39" },
];

function render(props = {}) {
  return renderToStaticMarkup(
    React.createElement(TaskOverview, {
      filter: "pending",
      categories,
      listCount: 4,
      counts: { pendientes: 9, hoy: 2, vencidas: 1 },
      ...props,
    }),
  );
}

describe("TaskOverview", () => {
  it("renders the pending heading, visible list count, and Spanish global metrics", () => {
    const html = render();

    expect(html).toContain("Pendientes");
    expect(html).toContain("4 tareas en esta vista");
    expect(html).toContain("9");
    expect(html).toContain("Pendientes");
    expect(html).toContain("2");
    expect(html).toContain("Para hoy");
    expect(html).toContain("1");
    expect(html).toContain("Vencidas");
  });

  it("keeps global SQL count metrics independent from the selected list count", () => {
    const html = render({
      listCount: 0,
      counts: { pendientes: 12, hoy: 3, vencidas: 2 },
    });

    expect(html).toContain("0 tareas en esta vista");
    expect(html).toContain("12");
    expect(html).toContain("3");
    expect(html).toContain("2");
  });

  it("uses category titles and falls back when a category filter no longer exists", () => {
    expect(render({ filter: "7" })).toContain("Trabajo");
    expect(render({ filter: "999" })).toContain("Categoría no encontrada");
  });

  it("renders accessible Spanish section and metric labels with zero counts", () => {
    const html = render({
      filter: "today",
      listCount: 0,
      counts: { pendientes: 0, hoy: 0, vencidas: 0 },
    });

    expect(html).toContain('aria-label="Resumen de tareas"');
    expect(html).toContain('aria-label="0 pendientes"');
    expect(html).toContain('aria-label="0 para hoy"');
    expect(html).toContain('aria-label="0 vencidas"');
    expect(html).toContain("No hay tareas que vencen hoy");
  });
});
