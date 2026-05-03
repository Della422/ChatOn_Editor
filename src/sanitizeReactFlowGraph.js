import { REGISTERED_NODE_TYPE_SET } from './knownNodeTypes.js'

/**
 * React Flow StoreUpdater는 node.position.x / y에 접근하므로
 * Liveblocks·로컬 어디서 오든 렌더 직전에 항상 유효한 Node 형태로 맞춘다.
 * (room 전체를 덮어쓰지 않고, 보이는/동기화되는 객체에만 기본값을 채움)
 */

/** @param {unknown} n */
function finiteNumber(n, fallback) {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

/**
 * id 문자열로 살짝 흩어진 기본 좌표 (같은 id면 항상 동일)
 * @param {string} id
 */
function staggeredPositionFromId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i)
  }
  const x = 120 + (Math.abs(h) % 14) * 48
  const y = 120 + (Math.abs(h >> 7) % 11) * 44
  return { x, y }
}

/**
 * @param {import('reactflow').Node | null | undefined} node
 * @param {number} index
 * @returns {import('reactflow').Node | null}
 */
export function sanitizeNodeForReactFlow(node, index) {
  if (node == null || typeof node !== 'object') return null

  const px = node.position?.x
  const py = node.position?.y
  const posAlreadyOk =
    typeof px === 'number' &&
    Number.isFinite(px) &&
    typeof py === 'number' &&
    Number.isFinite(py)
  const t0 =
    typeof node.type === 'string' && node.type.trim() !== '' ? node.type.trim() : ''
  const typeRegistered = t0 !== '' && REGISTERED_NODE_TYPE_SET.has(t0)
  if (posAlreadyOk && typeRegistered && node.data != null && typeof node.data === 'object') {
    return node
  }

  const rawId = node.id ?? node.data?.id
  const id =
    rawId != null && String(rawId).trim() !== ''
      ? String(rawId).trim()
      : `recovered-node-${index}`

  const rawType =
    typeof node.type === 'string' && node.type.trim() !== '' ? node.type.trim() : ''
  const type =
    rawType !== '' && REGISTERED_NODE_TYPE_SET.has(rawType) ? rawType : 'dialogue'

  const stagger = staggeredPositionFromId(id)
  const x = finiteNumber(px, stagger.x)
  const y = finiteNumber(py, stagger.y)

  const baseData =
    node.data != null && typeof node.data === 'object' ? { ...node.data } : {}
  baseData.id = id
  if (baseData.kind == null || baseData.kind === '') {
    baseData.kind = type
  }

  return {
    ...node,
    id,
    type,
    position: { x, y },
    data: baseData,
  }
}

/**
 * @param {import('reactflow').Node[] | null | undefined} nodes
 * @returns {import('reactflow').Node[]}
 */
export function sanitizeNodesForReactFlow(nodes) {
  if (!Array.isArray(nodes)) return []
  return nodes
    .map((n, i) => sanitizeNodeForReactFlow(n, i))
    .filter(Boolean)
}

/**
 * @param {import('reactflow').Edge | null | undefined} edge
 * @param {number} index
 * @returns {import('reactflow').Edge | null}
 */
export function sanitizeEdgeForReactFlow(edge, index) {
  if (edge == null || typeof edge !== 'object') return null
  const id =
    edge.id != null && String(edge.id).trim() !== ''
      ? String(edge.id).trim()
      : `edge-${index}`
  const source = edge.source != null ? String(edge.source) : ''
  const target = edge.target != null ? String(edge.target) : ''
  if (!source || !target) return null
  return {
    ...edge,
    id,
    source,
    target,
  }
}

/**
 * @param {import('reactflow').Edge[] | null | undefined} edges
 * @returns {import('reactflow').Edge[]}
 */
export function sanitizeEdgesForReactFlow(edges) {
  if (!Array.isArray(edges)) return []
  return edges
    .map((e, i) => sanitizeEdgeForReactFlow(e, i))
    .filter(Boolean)
}
