const routers = new Map<string, unknown>();

export function registerRouter(name: string, router: unknown) {
  routers.set(name, router);
}

export function getRouter(name: string) {
  return routers.get(name);
}
