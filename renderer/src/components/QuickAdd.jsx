import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, FileText, StickyNote, X, Link2 } from "lucide-react";
import parseQuickInput, { normalize } from "../lib/parseQuickInput";

const MODES = [
  { id: "task", label: "Tarea", icon: Plus },
  { id: "note", label: "Nota con título", icon: FileText },
  { id: "blank", label: "Nota en blanco", icon: StickyNote },
];

// Alto de la ventana por modo (el proceso main la redimensiona vía IPC)
const HEIGHTS = { task: 120, note: 332, blank: 296 };

const HINTS = {
  task: "Enter guardar · Esc cerrar · prueba: #trabajo !alta mañana",
  note: "Ctrl+Enter guardar · escribe un título nuevo o busca una tarea existente",
  blank: "Ctrl+Enter guardar · la primera línea será el título",
};

const EMPTY_TASK = {
  notes: "",
  priority: "normal",
  category_id: null,
  due_date: null,
  reminder_at: null,
};

function Chip({ chip }) {
  const styles = {
    priority:
      chip.label === "Prioridad alta"
        ? "bg-red-500/20 text-red-400"
        : "bg-white/10 text-white/50",
    date: "bg-indigo-500/20 text-indigo-300",
    category: "text-white",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full ${styles[chip.type]}`}
      style={
        chip.type === "category"
          ? { backgroundColor: `${chip.color}40`, color: chip.color }
          : undefined
      }
    >
      {chip.label}
    </span>
  );
}

export default function QuickAdd({ onSave, categories = [] }) {
  const [mode, setMode] = useState("task");
  const [taskValue, setTaskValue] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [blankBody, setBlankBody] = useState("");

  const taskRef = useRef(null);
  const noteTitleRef = useRef(null);
  const noteBodyRef = useRef(null);
  const blankRef = useRef(null);

  const parsed = useMemo(
    () => parseQuickInput(taskValue, categories),
    [taskValue, categories],
  );

  const suggestions = useMemo(() => {
    const term = normalize(noteTitle.trim());
    if (!term || term.length < 2 || selectedTask) return [];
    return pendingTasks
      .filter((t) => normalize(t.title).includes(term))
      .slice(0, 4);
  }, [noteTitle, pendingTasks, selectedTask]);

  const resetAll = () => {
    setMode("task");
    setTaskValue("");
    setNoteTitle("");
    setNoteBody("");
    setSelectedTask(null);
    setBlankBody("");
  };

  const close = () => {
    resetAll();
    window.taskAPI?.closeQuickAdd();
  };

  useEffect(() => {
    window.taskAPI?.onFocusQuickAdd?.(() => {
      resetAll();
      window.taskAPI?.resizeQuickAdd?.(HEIGHTS.task);
      setTimeout(() => taskRef.current?.focus(), 50);
    });
  }, []);

  useEffect(() => {
    window.taskAPI?.resizeQuickAdd?.(HEIGHTS[mode]);
    if (mode === "note")
      window.taskAPI?.getTasks?.("pending").then(setPendingTasks);
    const t = setTimeout(() => {
      if (mode === "task") taskRef.current?.focus();
      else if (mode === "note") noteTitleRef.current?.focus();
      else blankRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [mode]);

  const saveTask = async () => {
    if (!parsed.title.trim()) return;
    await onSave({
      ...EMPTY_TASK,
      title: parsed.title.trim(),
      priority: parsed.priority,
      category_id: parsed.category_id,
      due_date: parsed.due_date,
    });
    close();
  };

  const saveNote = async () => {
    const body = noteBody.trim();
    if (selectedTask) {
      if (!body) return;
      const merged = selectedTask.notes
        ? `${selectedTask.notes}\n\n${body}`
        : body;
      await window.taskAPI.updateTask(selectedTask.id, { notes: merged });
    } else {
      if (!noteTitle.trim()) return;
      await onSave({ ...EMPTY_TASK, title: noteTitle.trim(), notes: body });
    }
    close();
  };

  const saveBlank = async () => {
    const text = blankBody.trim();
    if (!text) return;
    const [firstLine, ...restLines] = text.split("\n");
    const first = firstLine.trim();
    const title =
      first.slice(0, 60) ||
      `Nota rápida — ${new Date().toLocaleDateString("es")}`;
    // Si el título quedó truncado, conservar el texto completo en las notas
    const notes =
      first.length > 60 ? text : restLines.join("\n").trim();
    await onSave({ ...EMPTY_TASK, title, notes });
    close();
  };

  const saveCurrent = () =>
    mode === "task" ? saveTask() : mode === "note" ? saveNote() : saveBlank();

  const handleGlobalKeys = (e) => {
    if (e.key === "Escape") close();
    if ((e.ctrlKey || e.metaKey) && ["1", "2", "3"].includes(e.key)) {
      e.preventDefault();
      setMode(MODES[Number(e.key) - 1].id);
    }
  };

  return (
    <div
      onKeyDown={handleGlobalKeys}
      className="flex flex-col h-screen bg-[#1a1a2e] border border-indigo-500/20 rounded-xl overflow-hidden"
    >
      {/* Selector de modo (zona arrastrable de la ventana sin marco) */}
      <div
        className="flex items-center gap-1 px-2 pt-2 shrink-0"
        style={{ WebkitAppRegion: "drag" }}
      >
        {MODES.map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            title={`Ctrl+${i + 1}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all ${
              mode === id
                ? "bg-indigo-500/25 text-indigo-300"
                : "text-white/35 hover:bg-white/5 hover:text-white/60"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido según modo */}
      {mode === "task" && (
        <div className="flex-1 flex flex-col px-4 min-h-0">
          <div className="flex-1 flex items-center gap-3">
            <Plus size={18} className="text-indigo-400 shrink-0" />
            <input
              ref={taskRef}
              value={taskValue}
              onChange={(e) => setTaskValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTask()}
              placeholder="¿Qué tienes en mente?"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
            />
          </div>
          {parsed.chips.length > 0 && (
            <div className="flex gap-1.5 pb-1.5 shrink-0">
              {parsed.chips.map((chip, i) => (
                <Chip key={i} chip={chip} />
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "note" && (
        <div className="flex-1 flex flex-col gap-2 px-4 py-2 min-h-0">
          {selectedTask ? (
            <div className="flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/25 rounded-lg px-3 py-1.5 text-xs text-indigo-300 shrink-0">
              <Link2 size={12} className="shrink-0" />
              <span className="truncate flex-1">
                Anexar a: {selectedTask.title}
              </span>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-indigo-300/60 hover:text-indigo-300 shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="relative shrink-0">
              <input
                ref={noteTitleRef}
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && noteBodyRef.current?.focus()
                }
                placeholder="Título nuevo o buscar tarea existente..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder-white/30 focus:border-indigo-500/40"
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#22223a] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                  {suggestions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTask(t);
                        setTimeout(() => noteBodyRef.current?.focus(), 0);
                      }}
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
            ref={noteBodyRef}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            onKeyDown={(e) =>
              (e.ctrlKey || e.metaKey) && e.key === "Enter" && saveNote()
            }
            placeholder="Escribe la nota, detalles, contexto..."
            className="flex-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none placeholder-white/25 resize-none leading-relaxed focus:border-indigo-500/40"
          />
        </div>
      )}

      {mode === "blank" && (
        <textarea
          ref={blankRef}
          value={blankBody}
          onChange={(e) => setBlankBody(e.target.value)}
          onKeyDown={(e) =>
            (e.ctrlKey || e.metaKey) && e.key === "Enter" && saveBlank()
          }
          placeholder={
            "Escribe libremente...\nLa primera línea será el título de la nota."
          }
          className="flex-1 mx-4 my-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none placeholder-white/25 resize-none leading-relaxed focus:border-indigo-500/40"
        />
      )}

      {/* Pie: ayuda + guardar */}
      <div className="flex items-center justify-between px-4 pb-2 shrink-0">
        <span className="text-[10px] text-white/25">{HINTS[mode]}</span>
        <button
          onClick={saveCurrent}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-all"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
