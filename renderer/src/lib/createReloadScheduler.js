// Coalesce cargas de datos en un único camino: como mucho una en vuelo y como
// mucho una recarga trailing pendiente por ráfaga. Mientras está oculto (`visible`
// en falso) no arranca cargas nuevas —la que ya estaba en vuelo puede terminar—,
// y al reabrirse siempre dispara una recarga, aunque no haya habido pedidos
// mientras tanto. No conoce el DOM: quien lo instancia decide qué es "visible" y
// qué hace `load`.
export function createReloadScheduler({ load, initialVisible = true } = {}) {
  let visible = initialVisible;
  let inFlight = false;
  let pending = false;
  let disposed = false;

  function iniciar() {
    inFlight = true;
    pending = false;
    Promise.resolve()
      .then(() => {
        // request()/dispose() son síncronos, pero load() se llama en un
        // microtask posterior: hay que revalidar acá, no solo al programar,
        // o un dispose()/setVisible(false) que llega entremedio no evita
        // la carga que ya estaba encolada.
        if (disposed || !visible) return;
        return load();
      })
      .catch(() => {})
      .finally(() => {
        inFlight = false;
        if (disposed) return;
        if (pending && visible) iniciar();
      });
  }

  function intentar() {
    if (disposed || !visible) return;
    if (inFlight) {
      pending = true;
      return;
    }
    iniciar();
  }

  function request() {
    if (disposed) return;
    intentar();
  }

  function setVisible(next) {
    if (disposed) return;
    const estabaOculto = !visible;
    visible = next;
    if (next && estabaOculto) intentar();
  }

  function dispose() {
    disposed = true;
  }

  return { request, setVisible, dispose };
}
