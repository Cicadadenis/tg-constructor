const callbacks = new Map<string, Record<string, unknown>>();

export function registerCallback(id: string, config: Record<string, unknown>) {
  callbacks.set(id, config);
}

export function getCallback(id: string) {
  return callbacks.get(id);
}

export function getAllCallbacks() {
  return [...callbacks.entries()];
}
