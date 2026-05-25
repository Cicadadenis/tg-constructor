/**
 * Collaboration prep — room identity and invite stubs (no realtime yet).
 */

const ROOM_KEY = 'cicada_collab_room';

/**
 * @param {string} projectId
 */
export function getOrCreateCollabRoom(projectId) {
  const id = projectId || '__draft__';
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (map[id]?.roomId) return map[id];
    const room = {
      roomId: `room_${id}_${Math.random().toString(36).slice(2, 9)}`,
      projectId: id,
      createdAt: Date.now(),
      members: [],
      mode: 'prep',
    };
    map[id] = room;
    localStorage.setItem(ROOM_KEY, JSON.stringify(map));
    return room;
  } catch {
    return {
      roomId: `room_${id}`,
      projectId: id,
      createdAt: Date.now(),
      members: [],
      mode: 'prep',
    };
  }
}

/**
 * @param {string} projectId
 * @param {string} [origin]
 */
export function buildInviteLink(projectId, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const room = getOrCreateCollabRoom(projectId);
  const params = new URLSearchParams({ collab: room.roomId, project: projectId || '__draft__' });
  return `${origin}/?${params.toString()}`;
}
