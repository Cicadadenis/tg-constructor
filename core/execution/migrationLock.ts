export class MigrationRegistryFrozenError extends Error {
  readonly code = "MIGRATION_REGISTRY_FROZEN" as const;

  constructor(message = "Migration registry is frozen") {
    super(message);
    this.name = "MigrationRegistryFrozenError";
  }
}

let registryFrozen = false;

export function freezeMigrationRegistry(): void {
  registryFrozen = true;
}

export function isMigrationRegistryFrozen(): boolean {
  return registryFrozen;
}

/** @internal Used by resetMigrationRegistry in tests. */
export function unfreezeMigrationRegistry(): void {
  registryFrozen = false;
}

export function assertMigrationRegistryMutable(action: string): void {
  if (!registryFrozen) return;

  throw new MigrationRegistryFrozenError(
    `Migration registry is frozen; cannot ${action}`,
  );
}
