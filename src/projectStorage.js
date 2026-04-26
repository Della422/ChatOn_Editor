import { initialEdges, initialNodes } from './defaultGraph'

const LEGACY_FLOW_KEY = 'chat_on_editor_flow'
const PROJECTS_STORE_KEY = 'chat_on_editor_projects_v1'

function nowIso() {
  return new Date().toISOString()
}

function emptyGraph() {
  return { nodes: [], edges: [] }
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * @returns {{ version: number, activeProjectId: string, projects: Record<string, { id: string, name: string, nodes: unknown[], edges: unknown[], updatedAt: string }> }}
 */
export function loadProjectsStore() {
  let store = null
  try {
    const raw = localStorage.getItem(PROJECTS_STORE_KEY)
    if (raw) {
      store = JSON.parse(raw)
    }
  } catch {
    store = null
  }

  if (!store || typeof store !== 'object' || !store.projects) {
    store = { version: 1, activeProjectId: '', projects: {} }
  }

  const projectCount = Object.keys(store.projects).length

  if (projectCount === 0) {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_FLOW_KEY)
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw)
        if (Array.isArray(legacy.nodes) && Array.isArray(legacy.edges)) {
          const id = `proj-${Date.now()}`
          store.projects[id] = {
            id,
            name: '이전 작업 (마이그레이션)',
            nodes: legacy.nodes,
            edges: legacy.edges,
            updatedAt: nowIso(),
          }
          store.activeProjectId = id
          saveProjectsStore(store)
          return store
        }
      }
    } catch {
      /* ignore */
    }

    const id = `proj-${Date.now()}`
    store.projects[id] = {
      id,
      name: '샘플 프로젝트',
      nodes: cloneDeep(initialNodes),
      edges: cloneDeep(initialEdges),
      updatedAt: nowIso(),
    }
    store.activeProjectId = id
    saveProjectsStore(store)
    return store
  }

  if (!store.activeProjectId || !store.projects[store.activeProjectId]) {
    store.activeProjectId = Object.keys(store.projects)[0]
    saveProjectsStore(store)
  }

  return store
}

export function saveProjectsStore(store) {
  localStorage.setItem(PROJECTS_STORE_KEY, JSON.stringify(store))
}

export function activateProject(store, projectId) {
  if (!store.projects[projectId]) return false
  store.activeProjectId = projectId
  saveProjectsStore(store)
  return true
}

export function projectSummaries(store) {
  return Object.values(store.projects)
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

export function persistActiveProjectGraph(store, activeProjectId, nodes, edges) {
  if (!activeProjectId || !store.projects[activeProjectId]) return
  store.projects[activeProjectId] = {
    ...store.projects[activeProjectId],
    nodes,
    edges,
    updatedAt: nowIso(),
  }
  store.activeProjectId = activeProjectId
  saveProjectsStore(store)
}

/** 현재 편집 중인 프로젝트에 그래프를 저장한 뒤 다른 프로젝트를 활성화합니다. */
export function switchActiveProject(store, fromProjectId, toProjectId, nodes, edges) {
  if (fromProjectId && store.projects[fromProjectId]) {
    store.projects[fromProjectId] = {
      ...store.projects[fromProjectId],
      nodes,
      edges,
      updatedAt: nowIso(),
    }
  }
  if (!store.projects[toProjectId]) return null
  store.activeProjectId = toProjectId
  saveProjectsStore(store)
  return store.projects[toProjectId]
}

export function createProject(store, name) {
  const id = `proj-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
  const graph = emptyGraph()
  store.projects[id] = {
    id,
    name: name.trim() || '이름 없는 프로젝트',
    nodes: graph.nodes,
    edges: graph.edges,
    updatedAt: nowIso(),
  }
  saveProjectsStore(store)
  return id
}

export function duplicateProject(store, sourceProjectId, newName) {
  const src = store.projects[sourceProjectId]
  if (!src) return null
  const id = `proj-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
  store.projects[id] = {
    id,
    name: newName.trim() || `${src.name} 복사`,
    nodes: cloneDeep(src.nodes),
    edges: cloneDeep(src.edges),
    updatedAt: nowIso(),
  }
  saveProjectsStore(store)
  return id
}

export function renameProject(store, projectId, newName) {
  if (!store.projects[projectId]) return false
  store.projects[projectId] = {
    ...store.projects[projectId],
    name: newName.trim() || store.projects[projectId].name,
    updatedAt: nowIso(),
  }
  saveProjectsStore(store)
  return true
}

export function deleteProject(store, projectId) {
  if (!store.projects[projectId]) return { ok: false, reason: 'not_found' }
  const ids = Object.keys(store.projects)
  if (ids.length <= 1) return { ok: false, reason: 'last_project' }

  delete store.projects[projectId]

  if (store.activeProjectId === projectId) {
    store.activeProjectId = Object.keys(store.projects)[0]
  }
  saveProjectsStore(store)
  return { ok: true, newActiveId: store.activeProjectId }
}

