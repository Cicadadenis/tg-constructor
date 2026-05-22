const states = new Map<string, string>();

export function registerState(name: string, group: string) {
  states.set(name, group);
}

export function getState(name: string) {
  return states.get(name);
}
