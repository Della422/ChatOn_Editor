/** `?room=`이 없을 때 Liveblocks `RoomProvider` id로 쓰는 기본값 (사람/세션마다 달라지지 않음) */
export const DEFAULT_LIVEBLOCKS_ROOM_ID = 'chaton-editor-demo'

/**
 * URL query `room` → Liveblocks room id. 동일 URL → 동일 id.
 * @returns {string}
 */
export function getRoomIdFromUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_LIVEBLOCKS_ROOM_ID
  }
  const raw = new URLSearchParams(window.location.search).get('room')
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed !== '' ? trimmed : DEFAULT_LIVEBLOCKS_ROOM_ID
}
