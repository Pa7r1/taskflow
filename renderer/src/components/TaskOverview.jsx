const FILTER_COPY = {
  pending: {
    title: "Pendientes",
    subtitle: "Todo lo que sigue abierto, con las vencidas arriba.",
    empty: "Sin pendientes. Buen trabajo.",
  },
  today: {
    title: "Hoy",
    subtitle: "Tareas con fecha límite para hoy.",
    empty: "No hay tareas que vencen hoy.",
  },
  all: {
    title: "Todas",
    subtitle: "Vista completa de tareas activas y completadas.",
    empty: "Todavía no cargaste tareas.",
  },
  completed: {
    title: "Completadas",
    subtitle: "Historial local de lo que ya cerraste.",
    empty: "No hay tareas completadas todavía.",
  },
};

const METRICS = [
  { key: "pendientes", label: "Pendientes" },
  { key: "hoy", label: "Para hoy" },
  { key: "vencidas", label: "Vencidas", tone: "danger" },
];

function pluralizeTasks(count) {
  return `${count} ${count === 1 ? "tarea" : "tareas"} en esta vista`;
}

function resolveCopy(filter, categories) {
  const fixed = FILTER_COPY[filter];
  if (fixed) return fixed;

  const category = categories.find((cat) => String(cat.id) === String(filter));
  if (!category) {
    return {
      title: "Categoría no encontrada",
      subtitle: "La categoría elegida ya no está disponible.",
      empty: "No hay tareas para esta categoría.",
    };
  }

  return {
    title: category.name,
    subtitle: "Tareas filtradas por categoría.",
    empty: "No hay tareas en esta categoría.",
  };
}

export default function TaskOverview({
  filter,
  categories,
  listCount,
  counts,
}) {
  const copy = resolveCopy(filter, categories);

  return (
    <section
      aria-label="Resumen de tareas"
      className="px-5 pt-5 pb-3 lg:px-6 lg:pt-7"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-indigo-300/70">
            Vista actual
          </p>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">
            {copy.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            {copy.subtitle}
          </p>
          <p className="mt-2 text-xs font-medium text-white/55">
            {pluralizeTasks(listCount)}
          </p>
          {listCount === 0 && (
            <p className="mt-2 text-xs text-indigo-200/60">{copy.empty}</p>
          )}
        </div>

        <dl
          className="grid grid-cols-3 gap-2 sm:w-[25rem]"
          data-testid="global-stats"
        >
          {METRICS.map((metric) => {
            const value = counts[metric.key] ?? 0;
            const danger = metric.tone === "danger" && value > 0;
            return (
              <div
                key={metric.key}
                aria-label={`${value} ${metric.label.toLowerCase()}`}
                className={`rounded-xl border px-3 py-2.5 ${
                  danger
                    ? "border-red-400/20 bg-red-500/10"
                    : "border-white/[0.08] bg-white/[0.04]"
                }`}
              >
                <dt className="truncate text-xs text-white/60">
                  {metric.label}
                </dt>
                <dd
                  className={`mt-1 text-xl font-semibold ${
                    danger ? "text-red-300" : "text-white/90"
                  }`}
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
