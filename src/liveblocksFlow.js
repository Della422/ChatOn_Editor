import { LiveObject } from '@liveblocks/client'
import { toPlainLson } from '@liveblocks/client'
import { sortNodesParentsBeforeChildren } from './groupNodeUtils'

/** @param {unknown} x */
function cloneJson(x) {
  return JSON.parse(JSON.stringify(x))
}

/**
 * useStorage 스냅샷: LiveMap이 직렬화된 plain 객체 레코드
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {import('reactflow').Node[]}
 */
export function storageRecordToNodes(record) {
  if (!record || typeof record !== 'object') return []
  const arr = Object.values(record).map((v) => cloneJson(v))
  return sortNodesParentsBeforeChildren(arr)
}

/**
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {import('reactflow').Edge[]}
 */
export function storageRecordToEdges(record) {
  if (!record || typeof record !== 'object') return []
  return Object.values(record).map((v) => cloneJson(v))
}

/**
 * useMutation 내부 LiveMap → 노드 배열
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 */
export function liveMapToSortedNodes(liveMap) {
  const out = []
  liveMap.forEach((liveVal) => {
    out.push(toPlainLson(liveVal))
  })
  return sortNodesParentsBeforeChildren(out)
}

/**
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 */
export function liveMapToEdges(liveMap) {
  const out = []
  liveMap.forEach((liveVal) => {
    out.push(toPlainLson(liveVal))
  })
  return out
}

/**
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 * @param {import('reactflow').Node[]} nextNodes
 */
export function syncNodesLiveMap(liveMap, nextNodes) {
  const sorted = sortNodesParentsBeforeChildren(nextNodes)
  const nextIds = new Set(sorted.map((n) => n.id))
  for (const id of liveMap.keys()) {
    if (!nextIds.has(id)) liveMap.delete(id)
  }
  for (const node of sorted) {
    liveMap.set(node.id, new LiveObject(cloneJson(node)))
  }
}

/**
 * @param {import('@liveblocks/client').LiveMap<string, import('@liveblocks/client').LiveObject>} liveMap
 * @param {import('reactflow').Edge[]} nextEdges
 */
export function syncEdgesLiveMap(liveMap, nextEdges) {
  const nextIds = new Set(nextEdges.map((e) => e.id))
  for (const id of liveMap.keys()) {
    if (!nextIds.has(id)) liveMap.delete(id)
  }
  for (const edge of nextEdges) {
    liveMap.set(edge.id, new LiveObject(cloneJson(edge)))
  }
}
