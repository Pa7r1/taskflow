# TaskFlow

Gestor de tareas de escritorio, local y sin cuentas. Todos los datos se guardan en tu máquina (SQLite); no hay backend ni sincronización por red.

Hecho con Electron, React, Vite y Tailwind.

## Funciones

- **Captura rápida global**: `Ctrl+Shift+Space` abre un popup desde cualquier lugar, con tres modos:
  - **Tarea**: un título y Enter.
  - **Nota con título**: escribí un título nuevo o buscá una tarea existente para anexarle la nota.
  - **Nota en blanco**: una hoja libre; la primera línea se convierte en el título.
- **Sintaxis rápida**: `Llamar al banco mañana !alta #trabajo` detecta fecha, prioridad y categoría al escribir. Soporta `hoy`, `mañana`, `pasado mañana`, días de la semana, `dd/mm`, `!alta`/`!baja` y `#categoría`.
- **Recordatorios del sistema**: notificaciones nativas que sobreviven reinicios de la app, más un resumen diario a las 9 am con lo que vence.
- **Organización**: categorías con color, prioridades, fechas límite con vista relativa ("mañana", "hace 2 días") y filtros (Hoy, Pendientes, Todas, Completadas). "Hoy" muestra solo lo que vence hoy; lo vencido y lo que no tiene fecha se recoge en "Pendientes", con las vencidas arriba y la fecha en que se pasaron.
- La app vive en la bandeja del sistema: cerrar la ventana no la detiene.

## Requisitos

- [Node.js](https://nodejs.org) 22.12 o superior (lo pide Electron 43)
- [pnpm](https://pnpm.io) 10 o superior — `corepack enable pnpm` si ya tenés Node
- Git

## Descarga

```bash
git clone https://github.com/Pa7r1/taskflow.git
cd taskflow
```

## Instalación

El proyecto es un workspace de pnpm con dos paquetes: la raíz (Electron) y `renderer/` (la interfaz). Un solo comando instala los dos:

```bash
pnpm install
```

`better-sqlite3` se compila contra el ABI de Electron, no contra el Node del sistema. El script `postinstall` lo recompila solo, así que **no hace falta ningún paso manual**. Si alguna vez aparece un error `NODE_MODULE_VERSION`, forzalo con:

```bash
pnpm run rebuild:native
```

## Ejecutar en desarrollo

```bash
pnpm start
```

Levanta el servidor de Vite y abre la app de Electron cuando está listo. La ventana principal puede cerrarse; la app queda en la bandeja y el atajo `Ctrl+Shift+Space` sigue funcionando.

## Empaquetar para tu sistema

```bash
pnpm run build
```

Genera el instalador según el sistema operativo donde lo ejecutes:

| Sistema | Salida                     |
| ------- | -------------------------- |
| Linux   | AppImage en `dist/`        |
| Windows | Instalador NSIS en `dist/` |
| macOS   | DMG en `dist/`             |

## Tests

```bash
pnpm test
```

Cubren la lógica pura del renderer: interpretación de la sintaxis rápida, cálculo de fechas y construcción de notas.

## Configuración (opcional)

Copiá `.env.example` a `.env` para sobrescribir valores locales como el puerto del servidor de desarrollo. El `.env` no se versiona.

## Lanzador de escritorio (Linux, opcional)

Para tener TaskFlow en el menú de aplicaciones:

```bash
./scripts/install-desktop.sh
```

Genera el lanzador con la ruta donde clonaste el proyecto (a partir de `TaskFlow.desktop.example`) y lo instala en `~/.local/share/applications/`.

## Dónde se guardan los datos

En el directorio de datos de usuario de Electron (`taskflow.db`):

- Linux: `~/.config/taskflow/`
- Windows: `%APPDATA%/taskflow/`
- macOS: `~/Library/Application Support/taskflow/`
