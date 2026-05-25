/**
 * JSON document helpers on ExecutionDbAccess (subscriber persistence layer).
 */

import type { ExecutionDbAccess } from "../../runtime/executionDb.js";

export async function dbGetJson<T>(db: ExecutionDbAccess, key: string): Promise<T | null> {
  const raw = await db.get(key);
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
  return raw as T;
}

export async function dbSetJson(db: ExecutionDbAccess, key: string, value: unknown): Promise<void> {
  await db.set(key, value);
}

export async function dbGetIdList(db: ExecutionDbAccess, key: string): Promise<string[]> {
  const list = await dbGetJson<string[]>(db, key);
  return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
}

export async function dbAppendId(db: ExecutionDbAccess, listKey: string, id: string): Promise<void> {
  const list = await dbGetIdList(db, listKey);
  if (!list.includes(id)) {
    await dbSetJson(db, listKey, [...list, id]);
  }
}

export async function dbRemoveId(db: ExecutionDbAccess, listKey: string, id: string): Promise<void> {
  const list = await dbGetIdList(db, listKey);
  await dbSetJson(
    db,
    listKey,
    list.filter((x) => x !== id),
  );
}
