import { LiveMap, LiveObject, toPlainLson } from '@liveblocks/client'
import { initialEdges, initialNodes } from './defaultGraph'
import { sortNodesParentsBeforeChildren } from './groupNodeUtils'
import { sanitizeNodeForReactFlow } from './sanitizeReactFlowGraph.js'

/** @param {unknown} x */
function cloneJson(x) {
  return JSON.parse(JSON.stringify(x))
}

/** Storage/LiveObject에 넣으면 안 되는 React Flow 런타임 필드 */
const EPHEMERAL_NODE_KEYS = ['selected', 'dragging']
const EPHEMERAL_EDGE_KEYS = ['selected']

/**
 * @param {import('reactflow').Node | Record<string, unknown> | null | undefined} node
 */
export function stripNodeForPersistence(node) {
  if (node == null || typeof node !== 'object') return node
  const out = { ...node }
  for (const k of EPHEMERAL_NODE_KEYS) delete out[k]
  return out
}

/**
 * @param {import('reactflow').Edge | Record<string, unknown> | null | undefined} edge
 */
export function stripEdgeForPersistence(edge) {
  if (edge == null || typeof edge !== 'object') return edge
  const out = { ...edge }
  for (const k of EPHEMERAL_EDGE_KEYS) delete out[k]
  return out
}

/**
 * LiveMap 키는 반드시 비어 있지 않은 문자열이어야 함(undefined면 Liveblocks asPos에서 크래시).
 * @param {import('reactflow').Node | Record<string, unknown> | null | undefined} node
 * @returns {string | null}
 */
export function resolveStorageNodeId(node) {
  if (node == null || typeof node !== 'object') return null
  const raw = /** @type {{ id?: unknown; data?: { id?: unknown } }} */ (node).id
  const fromData = /** @type {{ id?: unknown; data?: { id?: unknown } }} */ (node).data?.id
  const pick = raw ?? fromData
  if (pick == null) return null
  const s = String(pick).trim()
  return s.length > 0 ? s : null
}

/**
 * @param {import('reactflow').Node} node
 * @returns {import('reactflow').Node | null}
 */
function normalizeNodeForStorage(node) {
  const stripped = stripNodeForPersistence(node)
  const id = resolveStorageNodeId(stripped)
  if (!id) return null
  const copy = cloneJson(stripped)
  copy.id = id
  if (copy.data != null && typeof copy.data === 'object') {
    copy.data = { ...copy.data, id }
  } else {
    copy.data = { id }
  }
  return sanitizeNodeForReactFlow(copy, 0)
}

/**
 * 룸 스토리지 루트에 `nodes` / `edges` LiveMap이 없거나(또는 LiveMap이 아니면) 생성합니다.
 * 예전에 만든 빈 룸·다른 스키마에서는 `get('nodes')`가 undefined라 sync가 전부 no-op였음.
 * @param {import('@liveblocks/client').LiveObject} storageRoot
 */
/** 협업 룸이 완전히 비어 있을 때만 쓰는 샘플 그래프 (깊은 복사본) */
export function getCollaborationSeedGraph() {
  return {
    nodes: JSON.parse(JSON.stringify(initialNodes)),
    edges: JSON.parse(JSON.stringify(initialEdges)),
  }
}

export function ensureGraphStorageMaps(storageRoot) {
  let nodes = storageRoot.get('nodes')
  if (nodes == null || typeof nodes.forEach !== 'function') {
    nodes = new LiveMap()
    storageRoot.set('nodes', nodes)
  }
  let edges = storageRoot.get('edges')
  if (edges == null || typeof edges.forEach !== 'function') {
    edges = new LiveMap()
    storageRoot.set('edges', edges)
  }
  return { nodes, edges }
}

/**
 * useStorage 스냅샷: LiveMap이 직렬화된 plain 객체 레코드
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {import('reactflow').Node[]}
 */
export function storageRecordToNodes(record) {
  if (!record || typeof record !== 'object') return []
  const arr = Object.values(record)
    .map((v) => normalizeNodeForStorage(/** @type {import('reactflow').Node} */ (cloneJson(v))))
    .filter(Boolean)
  return sortNodesParentsBeforeChildren(arr)
}

/**
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {import('reactflow').Edge[]}
 */
function normalizeEdgeFromStorage(edge) {
  if (!edge || typeof edge !== 'object') return null
  const cleaned = stripEdgeForPersistence(edge)
  const id = String(/** @type {{ id?: unknown }} */ (cleaned).id ?? '').trim()
  if (!id) return null
  const source = String(/** @type {{ source?: unknown }} */ (cleaned).source ?? '').trim()
  const target = String(/** @type {{ target?: unknown }} */ (cleaned).target ?? '').trim()
  if (!source || !target) return null
  return { ...cloneJson(cleaned), id, source, target }
}

export function storageRecordToEdges(record) {
  if (!record || typeof record !== 'object') return []
  return Object.values(record)
    .map((v) => normalizeEdgeFromStorage(/** @type {import('reactflow').Edge} */ (v)))
    .filter(Boolean)
}

/**
 * useMutation 내부 LiveMap → 노드 배열
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 */
export function liveMapToSortedNodes(liveMap) {
  if (!liveMap || typeof liveMap.forEach !== 'function') return []
  const out = []
  liveMap.forEach((liveVal) => {
    const plain = toPlainLson(liveVal)
    const node = normalizeNodeForStorage(/** @type {import('reactflow').Node} */ (plain))
    if (node) out.push(node)
  })
  return sortNodesParentsBeforeChildren(out)
}

/**
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 */
export function liveMapToEdges(liveMap) {
  if (!liveMap || typeof liveMap.forEach !== 'function') return []
  const out = []
  liveMap.forEach((liveVal) => {
    const plain = toPlainLson(liveVal)
    const edge = normalizeEdgeFromStorage(/** @type {import('reactflow').Edge} */ (plain))
    if (edge) out.push(edge)
  })
  return out
}

/**
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 * @param {import('reactflow').Node[]} nextNodes
 */
export function syncNodesLiveMap(liveMap, nextNodes) {
  if (!liveMap || typeof liveMap.set !== 'function') return
  const normalized = nextNodes
    .map((n) => normalizeNodeForStorage(n))
    .filter(Boolean)
  const sorted = sortNodesParentsBeforeChildren(normalized)
  const nextIds = new Set(sorted.map((n) => n.id))
  for (const id of Array.from(liveMap.keys())) {
    if (!nextIds.has(id)) liveMap.delete(id)
  }
  for (const node of sorted) {
    const key = resolveStorageNodeId(node)
    if (!key) continue
    liveMap.set(key, new LiveObject(cloneJson(node)))
  }
}

/**
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 * @param {import('reactflow').Edge[]} nextEdges
 */
export function syncEdgesLiveMap(liveMap, nextEdges) {
  if (!liveMap || typeof liveMap.set !== 'function') return
  const withIds = nextEdges.filter((e) => e && String(e.id ?? '').trim().length > 0)
  const nextIds = new Set(withIds.map((e) => String(e.id)))
  for (const id of Array.from(liveMap.keys())) {
    if (!nextIds.has(id)) liveMap.delete(id)
  }
  for (const edge of withIds) {
    const key = String(edge.id)
    const plain = stripEdgeForPersistence({ ...edge, id: key })
    liveMap.set(key, new LiveObject(cloneJson(plain)))
  }
}

/**
 * LiveMap에 저장된 원본에 position 등이 깨져 있을 때만 1회 동기화로 고침.
 * 이미 유한한 x/y가 있으면 쓰지 않음(불필요한 storage 업데이트·리렌더 방지).
 * @param {import('@liveblocks/client').LiveObject} storageRoot
 */
export function repairLiveMapNodesIfNeeded(storageRoot) {
  const { nodes: nm } = ensureGraphStorageMaps(storageRoot)
  const fixedNodes = []
  let needWrite = false
  nm.forEach((liveVal) => {
    const plain = toPlainLson(liveVal)
    const fixed = normalizeNodeForStorage(/** @type {import('reactflow').Node} */ (plain))
    if (!fixed) return
    fixedNodes.push(fixed)
    const rx = plain?.position?.x
    const ry = plain?.position?.y
    if (
      typeof rx !== 'number' ||
      !Number.isFinite(rx) ||
      typeof ry !== 'number' ||
      !Number.isFinite(ry)
    ) {
      needWrite = true
    }
  })
  if (!needWrite) return
  syncNodesLiveMap(nm, sortNodesParentsBeforeChildren(fixedNodes))
}
