/** React Flow: 노드 내부 입력 시 드래그/팬/패널 클릭으로 오인되지 않게 */
export function stopNodeEventPropagation(event) {
  event.stopPropagation()
}

/** className에 nodrag nopan을 붙임 */
export function withNoDragNoPan(className) {
  return `${className ?? ''} nodrag nopan`.trim()
}

/** input / textarea / select / button — className은 withNoDragNoPan과 함께 사용 */
export const NODE_INNER_STOP_PROPAGATION = {
  onPointerDown: stopNodeEventPropagation,
  onMouseDown: stopNodeEventPropagation,
  onClick: stopNodeEventPropagation,
}
