import { toISODate, formatRelative } from "./dates";

// domingo = 0 … sábado = 6, igual que Date#getDay
const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

export function normalize(str) {
  return str
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function nextWeekday(weekday) {
  const today = new Date().getDay();
  const delta = ((weekday - today + 6) % 7) + 1; // siempre la próxima, nunca hoy
  return addDays(delta);
}

function parseDayMonth(day, month) {
  const now = new Date();
  let date = new Date(now.getFullYear(), month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date < today) date = new Date(now.getFullYear() + 1, month - 1, day);
  return toISODate(date);
}

/**
 * Interpreta tokens rápidos en el texto de una tarea:
 *   !alta / !baja        → prioridad
 *   #categoria           → categoría existente (insensible a mayúsculas/acentos)
 *   hoy / mañana / pasado mañana / lunes…domingo / dd/mm → fecha límite
 *
 * Devuelve { title, priority, category_id, due_date, chips } donde `chips`
 * describe lo detectado para mostrarlo en vivo bajo el input.
 */
export default function parseQuickInput(text, categories = []) {
  const result = {
    title: "",
    priority: "normal",
    category_id: null,
    due_date: null,
    chips: [],
  };
  const rest = [];
  const tokens = text.split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const tok = normalize(raw);

    if (tok === "!alta" || tok === "!baja") {
      result.priority = tok === "!alta" ? "high" : "low";
      result.chips.push({
        type: "priority",
        label: tok === "!alta" ? "Prioridad alta" : "Prioridad baja",
      });
      continue;
    }

    if (raw.startsWith("#") && raw.length > 1) {
      const name = normalize(raw.slice(1));
      const cat = categories.find((c) => normalize(c.name) === name);
      if (cat) {
        result.category_id = cat.id;
        result.chips.push({ type: "category", label: cat.name, color: cat.color });
        continue;
      }
    }

    if (!result.due_date) {
      let due = null;
      if (tok === "hoy") due = addDays(0);
      else if (tok === "pasado" && normalize(tokens[i + 1] || "") === "manana") {
        due = addDays(2);
        i++;
      } else if (tok === "manana") due = addDays(1);
      else if (WEEKDAYS.includes(tok)) due = nextWeekday(WEEKDAYS.indexOf(tok));
      else {
        const m = tok.match(/^(\d{1,2})[/-](\d{1,2})$/);
        if (m) due = parseDayMonth(parseInt(m[1], 10), parseInt(m[2], 10));
      }
      if (due) {
        result.due_date = due;
        result.chips.push({ type: "date", label: formatRelative(due) });
        continue;
      }
    }

    rest.push(raw);
  }

  result.title = rest.join(" ");
  return result;
}
