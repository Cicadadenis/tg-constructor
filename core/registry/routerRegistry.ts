const routers = new Map<string, Record<string, unknown>>();

export function registerRouter(name: string, config: Record<string, unknown> = {}) {
  routers.set(name, config);
}

export function getRouter(name: string) {
  return routers.get(name);
}

export function getAllRouters() {
  return [...routers.entries()];
}
