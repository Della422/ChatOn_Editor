/**
 * Liveblocks useStorage(selector, isEqual)용: 스냅샷 참조가 바뀌어도
 * 내용이 같으면 구독 컴포넌트가 불필요하게 리렌더되지 않게 함.
 * (리렌더 → 새 nodes 배열 → React Flow setNodes 반복 완화)
 */
export function storageRecordJsonEqual(a, b) {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  } catch {
    return false
  }
}
