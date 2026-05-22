/**
 * Close and forget Web Serial ports so Chrome does not pre-select them next time.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SerialPort/forget
 */
(function () {
  async function releaseAndForgetSerialPorts() {
    if (!('serial' in navigator)) return;
    let ports;
    try {
      ports = await navigator.serial.getPorts();
    } catch {
      return;
    }
    for (const port of ports) {
      try {
        if (port.readable || port.writable) await port.close();
      } catch {
        // ignore
      }
      try {
        if (typeof port.forget === 'function') await port.forget();
      } catch {
        // ignore — older browsers without forget()
      }
    }
  }

  window.CicadaSerialCleanup = { releaseAndForgetSerialPorts };
})();
