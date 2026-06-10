import { CheckSquare, Sun, List, Tag, Plus, Inbox } from "lucide-react";
import { useState } from "react";

const COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#ec4899",
  "#3b82f6",
];

export default function Sidebar({
  filter,
  setFilter,
  categories,
  tasks,
  onNewCategory,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  const pending = tasks.filter((t) => !t.completed).length;
  const today = tasks.filter(
    (t) =>
      !t.completed &&
      (t.due_date === new Date().toISOString().split("T")[0] || !t.due_date),
  ).length;

  const navItems = [
    { id: "today", label: "Hoy", icon: Sun, count: today },
    { id: "pending", label: "Pendientes", icon: Inbox, count: pending },
    { id: "all", label: "Todas", icon: List },
    { id: "completed", label: "Completadas", icon: CheckSquare },
  ];

  const handleAddCategory = async () => {
    if (!newName.trim()) return;
    await window.taskAPI.createCategory(newName.trim(), newColor);
    setNewName("");
    setAdding(false);
    onNewCategory();
  };

  return (
    <aside className="w-56 bg-[#13131a] flex flex-col py-10 px-3 gap-1 border-r border-white/5 shrink-0">
      <div className="px-3 mb-6">
        <h1 className="text-lg font-bold text-white tracking-tight">
          TaskFlow
        </h1>
        <p className="text-xs text-white/30">
          Ctrl+Shift+Space → captura rápida
        </p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              filter === id
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <Icon size={15} />
            <span className="flex-1 text-left">{label}</span>
            {count !== undefined && count > 0 && (
              <span className="text-xs bg-white/10 rounded-full px-1.5 py-0.5">
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-6 px-3 mb-2 flex items-center justify-between">
        <span className="text-xs text-white/30 uppercase tracking-wider">
          Categorías
        </span>
        <button
          onClick={() => setAdding(!adding)}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <div className="mx-2 mb-2 p-2 bg-white/5 rounded-lg">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            placeholder="Nombre..."
            className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none mb-2"
          />
          <div className="flex gap-1 flex-wrap mb-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{ backgroundColor: c }}
                className={`w-4 h-4 rounded-full transition-all ${newColor === c ? "ring-2 ring-white/50 scale-110" : ""}`}
              />
            ))}
          </div>
          <button
            onClick={handleAddCategory}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Crear
          </button>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(String(cat.id))}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              filter === String(cat.id)
                ? "bg-white/10 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            <span
              style={{ backgroundColor: cat.color }}
              className="w-2 h-2 rounded-full shrink-0"
            />
            <span>{cat.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
