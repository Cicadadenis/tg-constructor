const states = new Map<string, Record<string, unknown>>();

export function registerState(id: string, config: Record<string, unknown>) {
  states.set(id, config);
}

export function getState(id: string) {
  return states.get(id);
}

export function getAllStates() {
  return [...states.entries()];
}
