import { describe, it, expect, vi } from "vitest";
import { createReloadScheduler } from "./createReloadScheduler";

// Promesa controlable a mano, sin fake timers: el scheduler no usa temporizadores,
// así que alcanza con microtasks reales para probar el orden de resolución.
function deferido() {
  let resolver;
  let rechazar;
  const promesa = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

// El scheduler encadena then/catch/finally: cada salto es un microtask propio.
// Drenar la cola varias veces es determinista (no hay temporizadores de por
// medio) y evita atarse al número exacto de saltos internos.
async function drenarMicrotasks(vueltas = 10) {
  for (let i = 0; i < vueltas; i++) {
    await Promise.resolve();
  }
}

describe("createReloadScheduler", () => {
  it("dispara una carga al pedirla estando visible", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const scheduler = createReloadScheduler({ load, initialVisible: true });

    scheduler.request();
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("coalesce un ráfaga de pedidos en una sola recarga adicional (single-flight)", async () => {
    const primera = deferido();
    const load = vi
      .fn()
      .mockReturnValueOnce(primera.promesa)
      .mockResolvedValue(undefined);
    const scheduler = createReloadScheduler({ load, initialVisible: true });

    scheduler.request();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    // Ráfaga: mientras la primera sigue en vuelo, cinco pedidos más deben
    // coalescerse en una única recarga trailing, no en cinco.
    scheduler.request();
    scheduler.request();
    scheduler.request();
    scheduler.request();
    scheduler.request();
    expect(load).toHaveBeenCalledTimes(1);

    primera.resolver();
    await drenarMicrotasks();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("no arranca ninguna carga nueva mientras está oculto, y recarga al reabrir sin necesitar un pedido explícito", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const scheduler = createReloadScheduler({ load, initialVisible: false });

    scheduler.request();
    scheduler.request();
    scheduler.request();
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();

    scheduler.setVisible(true);
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("deja terminar la carga en vuelo al ocultarse a mitad de camino, y no arranca otra hasta que reabre", async () => {
    const enVuelo = deferido();
    const load = vi
      .fn()
      .mockReturnValueOnce(enVuelo.promesa)
      .mockResolvedValue(undefined);
    const scheduler = createReloadScheduler({ load, initialVisible: true });

    scheduler.request();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    scheduler.setVisible(false);
    // Un pedido llegado mientras está oculto no debe generar carga nueva.
    scheduler.request();

    enVuelo.resolver();
    await drenarMicrotasks();

    expect(load).toHaveBeenCalledTimes(1);

    scheduler.setVisible(true);
    await drenarMicrotasks();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("no queda atascada tras un error: la siguiente carga se puede pedir normalmente", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("falló la consulta"))
      .mockResolvedValue(undefined);
    const scheduler = createReloadScheduler({ load, initialVisible: true });

    scheduler.request();
    await drenarMicrotasks();
    expect(load).toHaveBeenCalledTimes(1);

    scheduler.request();
    await drenarMicrotasks();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("al eliminarse (dispose) durante una carga en vuelo, no ejecuta la recarga trailing pendiente", async () => {
    const enVuelo = deferido();
    const load = vi.fn().mockReturnValueOnce(enVuelo.promesa);
    const scheduler = createReloadScheduler({ load, initialVisible: true });

    scheduler.request();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    // Pedido extra mientras está en vuelo: queda pendiente hasta que se
    // resuelva la actual, salvo que el scheduler se elimine antes.
    scheduler.request();
    scheduler.dispose();

    enVuelo.resolver();
    await drenarMicrotasks();

    expect(load).toHaveBeenCalledTimes(1);

    // Tras eliminarse, ni pedidos ni cambios de visibilidad reviven la carga.
    scheduler.request();
    scheduler.setVisible(false);
    scheduler.setVisible(true);
    await drenarMicrotasks();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("si se oculta antes de que la carga programada llegue a ejecutar, esa carga no cuenta, pero reabrir sigue recargando", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const scheduler = createReloadScheduler({ load, initialVisible: true });

    // request() solo encola la carga en un microtask; setVisible(false)
    // corre sincrónicamente antes de que ese microtask llegue a ejecutar.
    scheduler.request();
    scheduler.setVisible(false);
    await new Promise((resolve) => setImmediate(resolve));

    expect(load).not.toHaveBeenCalled();

    scheduler.setVisible(true);
    await drenarMicrotasks();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("si se elimina (dispose) antes de que la carga programada llegue a ejecutar, nunca llega a cargar", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const scheduler = createReloadScheduler({ load, initialVisible: true });

    scheduler.request();
    scheduler.dispose();
    await new Promise((resolve) => setImmediate(resolve));

    expect(load).not.toHaveBeenCalled();

    scheduler.request();
    scheduler.setVisible(false);
    scheduler.setVisible(true);
    await drenarMicrotasks();

    expect(load).not.toHaveBeenCalled();
  });

  it("dos instancias son independientes: el estado de una no afecta a la otra", async () => {
    const loadA = vi.fn().mockResolvedValue(undefined);
    const loadB = vi.fn().mockResolvedValue(undefined);
    const schedulerA = createReloadScheduler({
      load: loadA,
      initialVisible: false,
    });
    const schedulerB = createReloadScheduler({
      load: loadB,
      initialVisible: true,
    });

    schedulerA.request();
    schedulerB.request();
    await Promise.resolve();

    expect(loadA).not.toHaveBeenCalled();
    expect(loadB).toHaveBeenCalledTimes(1);

    schedulerA.setVisible(true);
    await Promise.resolve();

    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(1);
  });
});
