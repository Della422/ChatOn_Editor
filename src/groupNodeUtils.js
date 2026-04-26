/** @param {unknown} val */
export function parseDim(val, fallback) {
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  if (typeof val === 'string') {
    const n = parseInt(val, 10)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

/**
 * Flow 좌표계에서 노드 박스 좌상단 절대 위치 (부모 체인 합산)
 * @param {import('reactflow').Node} node
 * @param {Map<string, import('reactflow').Node>} byId
 */
export function getAbsoluteTopLeft(node, byId) {
  let x = node.position.x
  let y = node.position.y
  let current = node
  while (current.parentNode) {
    const p = byId.get(current.parentNode)
    if (!p) break
    x += p.position.x
    y += p.position.y
    current = p
  }
  return { x, y }
}

/** 대략적인 노드 크기 (드래그 후 그룹 판정용) */
export function estimateNodeSize(node) {
  if (node.type === 'group') {
    return {
      w: parseDim(node.style?.width, 520),
      h: parseDim(node.style?.height, 380),
    }
  }
  if (node.type === 'dialogue') return { w: 280, h: 420 }
  if (node.type === 'logic') return { w: 280, h: 240 }
  if (node.type === 'branch') return { w: 280, h: 260 }
  return { w: 200, h: 120 }
}

/** React Flow 권장: 부모 노드가 항상 자식보다 앞에 오도록 정렬 */
export function sortNodesParentsBeforeChildren(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const done = new Set()
  const out = []

  function emit(n) {
    if (done.has(n.id)) return
    if (n.parentNode) {
      const p = byId.get(n.parentNode)
      if (p) emit(p)
    }
    done.add(n.id)
    out.push(n)
  }

  for (const n of nodes) {
    emit(n)
  }
  return out
}

/**
 * 드래그 종료 후: 노드 중심이 속한 가장 작은 그룹 박스 기준으로 parentNode 갱신
 * @param {import('reactflow').Node[]} allNodes
 * @param {string} draggedId
 */
export function resolveGroupReparent(allNodes, draggedId) {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const dragged = byId.get(draggedId)
  if (!dragged || dragged.type === 'group') return allNodes

  const abs = getAbsoluteTopLeft(dragged, byId)
  const size = estimateNodeSize(dragged)
  const cx = abs.x + size.w / 2
  const cy = abs.y + size.h / 2

  const groups = allNodes.filter((n) => n.type === 'group' && n.id !== dragged.id)
  let best = null
  let bestArea = Infinity
  for (const g of groups) {
    const gAbs = getAbsoluteTopLeft(g, byId)
    const gw = parseDim(g.style?.width, 520)
    const gh = parseDim(g.style?.height, 380)
    if (cx >= gAbs.x && cx <= gAbs.x + gw && cy >= gAbs.y && cy <= gAbs.y + gh) {
      const area = gw * gh
      if (area < bestArea) {
        bestArea = area
        best = g
      }
    }
  }

  const newParentId = best?.id ?? null
  const currentParent = dragged.parentNode ?? null

  if (newParentId === currentParent) {
    return allNodes
  }

  const next = allNodes.map((n) => {
    if (n.id !== draggedId) return n

    if (newParentId) {
      const gAbs = getAbsoluteTopLeft(best, byId)
      return {
        ...n,
        parentNode: newParentId,
        extent: 'parent',
        zIndex: 0,
        position: { x: abs.x - gAbs.x, y: abs.y - gAbs.y },
      }
    }
    return {
      ...n,
      parentNode: undefined,
      extent: undefined,
      zIndex: undefined,
      position: { x: abs.x, y: abs.y },
    }
  })

  return sortNodesParentsBeforeChildren(next)
}
