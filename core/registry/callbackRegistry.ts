const callbacks = new Map<string, string>();

export function registerCallback(id: string, handler: string) {
  callbacks.set(id, handler);
}

export function getCallback(id: string) {
  return callbacks.get(id);
}
