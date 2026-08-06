import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, FileText, StickyNote } from "lucide-react";
import parseQuickInput from "../lib/parseQuickInput";
import parseBlankNote from "../lib/parseBlankNote";
import QuickAddTask from "./quickadd/QuickAddTask";
import QuickAddNote from "./quickadd/QuickAddNote";
import QuickAddBlank from "./quickadd/QuickAddBlank";

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

/**
 * Chasis del popup de captura rápida: barra de modos, pie y guardado. Cada modo
 * es su propio componente; aquí solo vive lo que comparten.
 */
export default function QuickAdd({ onSave, categories = [] }) {
  const [mode, setMode] = useState("task");
  const [taskValue, setTaskValue] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [blankBody, setBlankBody] = useState("");
  const [error, setError] = useState(null);

  const taskRef = useRef(null);
  const noteTitleRef = useRef(null);
  const noteBodyRef = useRef(null);
  const blankRef = useRef(null);

  // El handler de foco se registra una sola vez al montar; lee el modo y la
  // selección vigentes desde refs para enfocar el input correcto al reabrir.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const selectedTaskRef = useRef(selectedTask);
  selectedTaskRef.current = selectedTask;

  const focusMode = (m = modeRef.current) => {
    if (m === "task") taskRef.current?.focus();
    else if (m === "note")
      (selectedTaskRef.current ? noteBodyRef : noteTitleRef).current?.focus();
    else blankRef.current?.focus();
  };

  const parsed = useMemo(
    () => parseQuickInput(taskValue, categories),
    [taskValue, categories],
  );

  const resetAll = () => {
    setMode("task");
    setTaskValue("");
    setNoteTitle("");
    setNoteBody("");
    setSelectedTask(null);
    setBlankBody("");
    setError(null);
  };

  const close = () => {
    resetAll();
    window.taskAPI?.closeQuickAdd();
  };

  // Solo se cierra la ventana si el guardado salió bien. Si falla, el borrador
  // se conserva y el error se ve en el pie: perder lo escrito por un fallo de la
  // base sería el peor desenlace posible.
  //
  // `accion` devuelve el registro guardado, o null si App capturó un error.
  const guardar = async (accion) => {
    try {
      setError(null);
      const guardado = await accion();
      if (!guardado) {
        setError("No se pudo guardar. Vuelve a intentarlo.");
        return;
      }
      close();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    }
  };

  useEffect(() => {
    // Al reabrir el popup se conserva el borrador (el componente sigue montado
    // mientras la ventana está oculta). main encoge la ventana al ocultarla, así
    // que solo restauramos la altura del modo actual y reenfocamos su input.
    let temporizador;
    const desuscribir = window.taskAPI?.onFocusQuickAdd?.(() => {
      window.taskAPI?.resizeQuickAdd?.(HEIGHTS[modeRef.current]);
      clearTimeout(temporizador);
      temporizador = setTimeout(() => focusMode(), 50);
    });
    return () => {
      clearTimeout(temporizador);
      desuscribir?.();
    };
  }, []);

  useEffect(() => {
    window.taskAPI?.resizeQuickAdd?.(HEIGHTS[mode]);
    let cancelado = false;
    if (mode === "note")
      window.taskAPI
        ?.getTasks?.("pending")
        .then((tareas) => !cancelado && setPendingTasks(tareas))
        .catch((e) => !cancelado && setError(e.message));
    const t = setTimeout(() => focusMode(mode), 0);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [mode]);

  const saveTask = () => {
    if (!parsed.title.trim()) return;
    return guardar(() =>
      onSave({
        ...EMPTY_TASK,
        title: parsed.title.trim(),
        priority: parsed.priority,
        category_id: parsed.category_id,
        due_date: parsed.due_date,
      }),
    );
  };

  const saveNote = () => {
    const cuerpo = noteBody.trim();
    if (selectedTask) {
      if (!cuerpo) return;
      const unido = selectedTask.notes
        ? `${selectedTask.notes}\n\n${cuerpo}`
        : cuerpo;
      return guardar(() =>
        window.taskAPI.updateTask(selectedTask.id, { notes: unido }),
      );
    }
    if (!noteTitle.trim()) return;
    return guardar(() =>
      onSave({ ...EMPTY_TASK, title: noteTitle.trim(), notes: cuerpo }),
    );
  };

  const saveBlank = () => {
    const nota = parseBlankNote(blankBody);
    if (!nota) return;
    return guardar(() => onSave({ ...EMPTY_TASK, ...nota }));
  };

  const guardadores = { task: saveTask, note: saveNote, blank: saveBlank };
  const saveCurrent = () => guardadores[mode]();

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
      className="flex flex-col h-screen bg-popup border border-indigo-500/20 rounded-xl overflow-hidden"
    >
      {/* Selector de modo (zona arrastrable de la ventana sin marco) */}
      <div
        className="flex items-center gap-1 px-2 pt-2 shrink-0"
        style={{ WebkitAppRegion: "drag" }}
        role="tablist"
        aria-label="Modo de captura"
      >
        {MODES.map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
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

      {mode === "task" && (
        <QuickAddTask
          valor={taskValue}
          onChange={setTaskValue}
          parsed={parsed}
          onGuardar={saveTask}
          inputRef={taskRef}
        />
      )}

      {mode === "note" && (
        <QuickAddNote
          titulo={noteTitle}
          onTituloChange={setNoteTitle}
          cuerpo={noteBody}
          onCuerpoChange={setNoteBody}
          tareaElegida={selectedTask}
          onElegirTarea={(t) => {
            setSelectedTask(t);
            if (t) setTimeout(() => noteBodyRef.current?.focus(), 0);
          }}
          tareasPendientes={pendingTasks}
          onGuardar={saveNote}
          tituloRef={noteTitleRef}
          cuerpoRef={noteBodyRef}
        />
      )}

      {mode === "blank" && (
        <QuickAddBlank
          valor={blankBody}
          onChange={setBlankBody}
          onGuardar={saveBlank}
          inputRef={blankRef}
        />
      )}

      {/* Pie: ayuda (o el error) + guardar */}
      <div className="flex items-center justify-between px-4 pb-2 shrink-0">
        <span
          role={error ? "alert" : undefined}
          className={`text-[10px] ${error ? "text-red-400" : "text-white/25"}`}
        >
          {error || HINTS[mode]}
        </span>
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
