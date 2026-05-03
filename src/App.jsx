import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import { useMutation, useStorage } from '@liveblocks/react'
import EditorLayout from './EditorLayout.jsx'
import { EditorGraphProvider } from './EditorGraphContext.jsx'
import {
  getAbsoluteTopLeft,
  resolveGroupReparent,
  sortNodesParentsBeforeChildren,
  parseDim,
} from './groupNodeUtils'
import {
  activateProject,
  createProject,
  deleteProject,
  duplicateProject,
  loadProjectsStore,
  persistActiveProjectGraph,
  projectSummaries,
  renameProject,
  switchActiveProject,
} from './projectStorage'
import {
  ensureGraphStorageMaps,
  getCollaborationSeedGraph,
  liveMapToEdges,
  liveMapToSortedNodes,
  storageRecordToEdges,
  storageRecordToNodes,
  repairLiveMapNodesIfNeeded,
  syncEdgesLiveMap,
  syncNodesLiveMap,
} from './liveblocksFlow'
import { storageRecordJsonEqual } from './storageEquality.js'
import { REGISTERED_NODE_TYPE_SET } from './knownNodeTypes.js'

const COLLAB_ENABLED = Boolean(import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY?.trim())

/**
 * 선택 상태는 Liveblocks에 두지 않고 로컬(flowSelected*)로만 병합함.
 * select 변경까지 storage에 커밋하면 스냅샷→props 갱신→StoreUpdater가 다시 select를
 * 쏘는 식으로 Maximum update depth 루프가 날 수 있음.
 * @param {import('reactflow').NodeChange[] | import('reactflow').EdgeChange[]} changes
 */
function changesWithoutSelect(changes) {
  return changes.filter((c) => c.type !== 'select')
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

/** node.type·data.kind·UI 프리셋 (버튼별 생성이 항상 올바른 타입을 쓰도록) */
const NODE_CREATE_PRESETS = {
  dialogue: { kind: 'dialogue', title: '대사 노드' },
  logic: { kind: 'logic', title: '로직 노드' },
  branch: { kind: 'branch', title: '분기 노드' },
  group: { kind: 'group', title: '그룹' },
  event: { kind: 'event', title: '이벤트 노드' },
  choice: { kind: 'choice', title: '선택지 노드' },
}

function createDefaultData(type, id) {
  const preset = NODE_CREATE_PRESETS[type] ?? NODE_CREATE_PRESETS.dialogue
  const kind = preset.kind

  if (type === 'logic') {
    return {
      id,
      kind,
      title: preset.title,
      operations: [{ id: randomId('op'), variable: '', operator: '=', value: '' }],
    }
  }
  if (type === 'branch') {
    return {
      id,
      kind,
      title: preset.title,
      condition: { variable: '', operator: '==', value: '' },
    }
  }
  if (type === 'group') {
    return { id, kind, title: preset.title, label: 'New Group' }
  }
  if (type === 'event') {
    return { id, kind, title: preset.title, body: '' }
  }
  if (type === 'choice') {
    return { id, kind, title: preset.title, body: '', options: [] }
  }
  return {
    id,
    kind,
    title: preset.title,
    character: '',
    text: '',
    customProperties: [],
  }
}

function getBootState() {
  if (typeof window === 'undefined') {
    return {
      nodes: [],
      edges: [],
      activeProjectId: '',
      projectList: [],
    }
  }
  const store = loadProjectsStore()
  const id = store.activeProjectId
  const p = store.projects[id]
  return {
    nodes: p.nodes,
    edges: p.edges,
    activeProjectId: id,
    projectList: projectSummaries(store),
  }
}

function isEditableElement(target) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

function EditorBody({
  boot,
  nodes,
  edges,
  setNodes,
  setEdges,
  onNodesChange,
  onEdgesChange,
  persistOnGraphChange,
  promptBeforeProjectSwitch,
}) {
  const [activeProjectId, setActiveProjectId] = useState(boot.activeProjectId)
  const [projectList, setProjectList] = useState(boot.projectList)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  /** Storage 스냅샷에 selected가 없어 RF 제어 모드에서 선택이 풀리지 않게 로컬로 병합 */
  const [flowSelectedNodeIds, setFlowSelectedNodeIds] = useState([])
  const [flowSelectedEdgeIds, setFlowSelectedEdgeIds] = useState([])
  const [contextMenu, setContextMenu] = useState(null)
  const [quickConnectMode, setQuickConnectMode] = useState(false)
  const [quickConnectSourceId, setQuickConnectSourceId] = useState(null)
  const [branchConnectPath, setBranchConnectPath] = useState('true')
  const [toast, setToast] = useState(null)
  const historyRef = useRef([])
  const redoRef = useRef([])
  const isRestoringRef = useRef(false)
  const prevSnapshotRef = useRef({ nodes: boot.nodes, edges: boot.edges })
  const toastTimerRef = useRef(null)
  /** onSelectionChange가 같은 선택으로 연속 호출될 때 setState·리렌더 폭주 방지 */
  const flowSelectionKeyRef = useRef('')

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1800)
  }, [])

  useEffect(() => {
    if (!persistOnGraphChange) return
    const store = loadProjectsStore()
    persistActiveProjectGraph(store, activeProjectId, nodes, edges)
    // 프로젝트 메타(updatedAt·정렬)를 타이틀 드롭다운과 맞추기 위해 동기 갱신
    setProjectList(projectSummaries(store)) // eslint-disable-line react-hooks/set-state-in-effect -- 로컬 스토어 미러링
  }, [nodes, edges, activeProjectId, persistOnGraphChange])

  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false
      prevSnapshotRef.current = { nodes, edges }
      return
    }

    const prev = prevSnapshotRef.current
    if (prev.nodes === nodes && prev.edges === edges) return
    historyRef.current.push(prev)
    if (historyRef.current.length > 120) {
      historyRef.current.shift()
    }
    redoRef.current = []
    prevSnapshotRef.current = { nodes, edges }
  }, [nodes, edges])

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    },
    [],
  )

  const deleteNodesByIds = useCallback((nodeIds) => {
    if (!nodeIds.length) return
    const deleting = new Set(nodeIds)
    setNodes((current) => {
      const byId = new Map(current.map((n) => [n.id, n]))
      const next = current
        .filter((node) => !deleting.has(node.id))
        .map((node) => {
          if (!node.parentNode || !deleting.has(node.parentNode)) {
            return node
          }
          const abs = getAbsoluteTopLeft(node, byId)
          return {
            ...node,
            parentNode: undefined,
            extent: undefined,
            zIndex: undefined,
            position: { x: abs.x, y: abs.y },
          }
        })
      return sortNodesParentsBeforeChildren(next)
    })
    setEdges((current) =>
      current.filter(
        (edge) => !deleting.has(edge.source) && !deleting.has(edge.target),
      ),
    )
  }, [setEdges, setNodes])

  const deleteEdgesByIds = useCallback((edgeIds) => {
    if (!edgeIds.length) return
    const deleting = new Set(edgeIds)
    setEdges((current) => current.filter((edge) => !deleting.has(edge.id)))
  }, [setEdges])

  const deleteSelected = useCallback(() => {
    if (!flowSelectedNodeIds.length && !flowSelectedEdgeIds.length) return
    deleteNodesByIds(flowSelectedNodeIds)
    deleteEdgesByIds(flowSelectedEdgeIds)
    if (flowSelectedNodeIds.includes(selectedNodeId)) {
      setSelectedNodeId(null)
    }
    flowSelectionKeyRef.current = ''
    setFlowSelectedNodeIds([])
    setFlowSelectedEdgeIds([])
  }, [
    deleteEdgesByIds,
    deleteNodesByIds,
    flowSelectedEdgeIds,
    flowSelectedNodeIds,
    selectedNodeId,
  ])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isEditableElement(event.target)) return

      const isUndoKey =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'z'
      if (isUndoKey) {
        event.preventDefault()
        const snapshot = historyRef.current.pop()
        if (!snapshot) {
          showToast('되돌릴 작업이 없습니다.')
          return
        }
        redoRef.current.push({ nodes, edges })
        isRestoringRef.current = true
        setNodes(snapshot.nodes)
        setEdges(snapshot.edges)
        setContextMenu(null)
        setSelectedNodeId(null)
        flowSelectionKeyRef.current = ''
        setFlowSelectedNodeIds([])
        setFlowSelectedEdgeIds([])
        setQuickConnectSourceId(null)
        showToast('이전 작업으로 되돌렸습니다.')
        return
      }

      const isRedoKey =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        (event.key.toLowerCase() === 'y' ||
          (event.shiftKey && event.key.toLowerCase() === 'z'))
      if (isRedoKey) {
        event.preventDefault()
        const snapshot = redoRef.current.pop()
        if (!snapshot) {
          showToast('다시 실행할 작업이 없습니다.')
          return
        }
        historyRef.current.push({ nodes, edges })
        if (historyRef.current.length > 120) {
          historyRef.current.shift()
        }
        isRestoringRef.current = true
        setNodes(snapshot.nodes)
        setEdges(snapshot.edges)
        setContextMenu(null)
        setSelectedNodeId(null)
        flowSelectionKeyRef.current = ''
        setFlowSelectedNodeIds([])
        setFlowSelectedEdgeIds([])
        setQuickConnectSourceId(null)
        showToast('다시 실행했습니다.')
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (!flowSelectedNodeIds.length && !flowSelectedEdgeIds.length) return
      event.preventDefault()
      deleteSelected()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected, edges, flowSelectedEdgeIds.length, flowSelectedNodeIds.length, nodes, setEdges, setNodes, showToast])

  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const addNodeByType = useCallback(
    (type) => {
      const resolvedType = REGISTERED_NODE_TYPE_SET.has(type) ? type : 'dialogue'
      const id = randomId(resolvedType)
      const offset = nodes.length % 5
      setNodes((current) => {
        const base = {
          id,
          type: resolvedType,
          position: { x: 220 + offset * 220, y: 220 + offset * 110 },
          data: createDefaultData(resolvedType, id),
        }
        if (resolvedType === 'group') {
          base.position = { x: 80 + offset * 48, y: 320 + offset * 40 }
          base.style = { width: 520, height: 380, zIndex: -1 }
          base.connectable = false
          const chapterIndex = current.filter((n) => n.type === 'group').length + 1
          base.data = { ...base.data, label: `Chapter ${chapterIndex}` }
        }
        return sortNodesParentsBeforeChildren([...current, base])
      })
    },
    [nodes.length, setNodes],
  )

  const handleNodeDragStop = useCallback((_, node) => {
    if (node.type === 'group') return
    setNodes((current) => resolveGroupReparent(current, node.id))
  }, [setNodes])

  const onConnect = useCallback(
    (connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)
      if (sourceNode?.type === 'group' || targetNode?.type === 'group') {
        showToast('그룹 노드에는 연결할 수 없습니다.')
        return
      }
      const isDuplicate = edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
          (edge.targetHandle ?? null) === (connection.targetHandle ?? null),
      )
      if (isDuplicate) {
        showToast('이미 같은 연결이 있습니다.')
        return
      }

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: randomId('edge'),
            animated: true,
            style: {
              stroke: connection.sourceHandle === 'false' ? '#ff6b8a' : '#7b61ff',
              strokeWidth: 2,
            },
          },
          current,
        ),
      )
    },
    [edges, nodes, setEdges, showToast],
  )

  const quickConnectNodes = useCallback(
    (sourceId, targetId) => {
      const sourceNode = nodes.find((node) => node.id === sourceId)
      const targetNode = nodes.find((node) => node.id === targetId)
      if (!sourceNode || sourceId === targetId) return
      if (sourceNode.type === 'group' || targetNode?.type === 'group') {
        showToast('그룹 노드에는 연결할 수 없습니다.')
        return
      }
      const sourceHandle = sourceNode.type === 'branch' ? branchConnectPath : undefined
      const isDuplicate = edges.some(
        (edge) =>
          edge.source === sourceId &&
          edge.target === targetId &&
          (edge.sourceHandle ?? null) === (sourceHandle ?? null),
      )
      if (isDuplicate) {
        showToast('이미 같은 연결이 있습니다.')
        return
      }

      setEdges((current) =>
        addEdge(
          {
            id: randomId('edge'),
            source: sourceId,
            target: targetId,
            sourceHandle,
            animated: true,
            style: {
              stroke: sourceHandle === 'false' ? '#ff6b8a' : '#7b61ff',
              strokeWidth: 2,
            },
          },
          current,
        ),
      )
    },
    [branchConnectPath, edges, nodes, setEdges, showToast],
  )

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const nodesForFlow = useMemo(() => {
    const sel = new Set(flowSelectedNodeIds)
    return nodes.map((node) =>
      sel.has(node.id) ? { ...node, selected: true } : { ...node, selected: false },
    )
  }, [nodes, flowSelectedNodeIds])

  const edgesForFlow = useMemo(() => {
    const sel = new Set(flowSelectedEdgeIds)
    return edges.map((edge) =>
      sel.has(edge.id) ? { ...edge, selected: true } : { ...edge, selected: false },
    )
  }, [edges, flowSelectedEdgeIds])

  const handleFlowSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      const nodeIds = selectedNodes.map((n) => n.id)
      const edgeIds = selectedEdges.map((e) => e.id)
      const key = `n:${nodeIds.join(',')}|e:${edgeIds.join(',')}`
      if (key === flowSelectionKeyRef.current) return
      flowSelectionKeyRef.current = key
      setFlowSelectedNodeIds(nodeIds)
      setFlowSelectedEdgeIds(edgeIds)
      setSelectedNodeId(selectedNodes[0]?.id ?? null)
    },
    [],
  )

  const clearFlowSelection = useCallback(() => {
    flowSelectionKeyRef.current = ''
    setFlowSelectedNodeIds([])
    setFlowSelectedEdgeIds([])
    setSelectedNodeId(null)
  }, [])

  /** 컨텍스트 메뉴 등에서 Inspector만 열 때 RF 선택 링과 맞춤 */
  const focusNodeInInspector = useCallback((nodeId) => {
    if (nodeId == null || String(nodeId).trim() === '') return
    const id = String(nodeId)
    flowSelectionKeyRef.current = `n:${id}|e:`
    setFlowSelectedNodeIds([id])
    setFlowSelectedEdgeIds([])
    setSelectedNodeId(id)
  }, [])

  const mergeNodeData = useCallback((nodeId, patch) => {
    if (nodeId == null || String(nodeId).trim() === '') return
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    )
  }, [setNodes])

  const addInspectorRow = useCallback((nodeId, listKey, seed) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId) return node
        return {
          ...node,
          data: {
            ...node.data,
            [listKey]: [...(node.data[listKey] ?? []), { ...seed, id: randomId('row') }],
          },
        }
      }),
    )
  }, [setNodes])

  const updateInspectorRow = useCallback((nodeId, listKey, rowId, field, value) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId) return node
        const next = (node.data[listKey] ?? []).map((row) =>
          row.id === rowId ? { ...row, [field]: value } : row,
        )
        return { ...node, data: { ...node.data, [listKey]: next } }
      }),
    )
  }, [setNodes])

  const removeInspectorRow = useCallback((nodeId, listKey, rowId) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId) return node
        const next = (node.data[listKey] ?? []).filter((row) => row.id !== rowId)
        return { ...node, data: { ...node.data, [listKey]: next } }
      }),
    )
  }, [setNodes])

  const currentProjectName = useMemo(
    () => projectList.find((p) => p.id === activeProjectId)?.name ?? '',
    [projectList, activeProjectId],
  )

  const switchToProject = useCallback(
    (newId) => {
      if (newId === activeProjectId) return
      if (
        promptBeforeProjectSwitch &&
        !window.confirm(
          '공유 캔버스가 선택한 로컬 프로젝트 내용으로 바뀝니다. 다른 사용자에게도 동일하게 적용됩니다. 계속할까요?',
        )
      ) {
        return
      }
      const store = loadProjectsStore()
      const p = switchActiveProject(store, activeProjectId, newId, nodes, edges)
      if (!p) return
      isRestoringRef.current = true
      historyRef.current = []
      redoRef.current = []
      setActiveProjectId(newId)
      setProjectList(projectSummaries(store))
      setNodes(p.nodes)
      setEdges(p.edges)
    },
    [activeProjectId, edges, nodes, promptBeforeProjectSwitch, setEdges, setNodes],
  )

  const handleNewProject = useCallback(() => {
    const name = window.prompt(
      '새 프로젝트 이름을 입력하세요.',
      `프로젝트 ${projectList.length + 1}`,
    )
    if (name === null) return
    const store = loadProjectsStore()
    persistActiveProjectGraph(store, activeProjectId, nodes, edges)
    const newId = createProject(store, name.trim() || '새 프로젝트')
    activateProject(store, newId)
    const p = store.projects[newId]
    isRestoringRef.current = true
    historyRef.current = []
    redoRef.current = []
    setActiveProjectId(newId)
    setProjectList(projectSummaries(store))
    setNodes(p.nodes)
    setEdges(p.edges)
    showToast('새 프로젝트를 만들었습니다.')
  }, [activeProjectId, edges, nodes, projectList.length, setEdges, setNodes, showToast])

  const handleRenameProject = useCallback(() => {
    const current =
      projectList.find((p) => p.id === activeProjectId)?.name ?? ''
    const name = window.prompt('프로젝트 이름 변경', current)
    if (name === null || !name.trim()) return
    const store = loadProjectsStore()
    renameProject(store, activeProjectId, name)
    setProjectList(projectSummaries(store))
    showToast('프로젝트 이름을 바꿨습니다.')
  }, [activeProjectId, projectList, showToast])

  const handleDuplicateProject = useCallback(() => {
    const store = loadProjectsStore()
    persistActiveProjectGraph(store, activeProjectId, nodes, edges)
    const baseName = store.projects[activeProjectId]?.name ?? '프로젝트'
    const name = window.prompt('복사본 이름', `${baseName} 복사`)
    if (name === null) return
    const newId = duplicateProject(store, activeProjectId, name)
    if (!newId) return
    activateProject(store, newId)
    const p = store.projects[newId]
    isRestoringRef.current = true
    historyRef.current = []
    redoRef.current = []
    setActiveProjectId(newId)
    setProjectList(projectSummaries(store))
    setNodes(p.nodes)
    setEdges(p.edges)
    showToast('프로젝트를 복사했습니다.')
  }, [activeProjectId, edges, nodes, setEdges, setNodes, showToast])

  const handleDeleteProject = useCallback(() => {
    if (!window.confirm('이 프로젝트를 삭제할까요? 저장된 내용은 복구할 수 없습니다.')) {
      return
    }
    const store = loadProjectsStore()
    persistActiveProjectGraph(store, activeProjectId, nodes, edges)
    const result = deleteProject(store, activeProjectId)
    if (!result.ok) {
      showToast(
        result.reason === 'last_project'
          ? '마지막 프로젝트는 삭제할 수 없습니다.'
          : '삭제에 실패했습니다.',
      )
      return
    }
    const p = store.projects[result.newActiveId]
    isRestoringRef.current = true
    historyRef.current = []
    redoRef.current = []
    setActiveProjectId(result.newActiveId)
    setProjectList(projectSummaries(store))
    setNodes(p.nodes)
    setEdges(p.edges)
    showToast('프로젝트를 삭제했습니다.')
  }, [activeProjectId, edges, nodes, setEdges, setNodes, showToast])

  const downloadJson = useCallback(() => {
    const outputMap = edges.reduce((acc, edge) => {
      const current = acc[edge.source] ?? []
      current.push({
        edgeId: edge.id,
        toNodeId: edge.target,
        branch: edge.sourceHandle ?? null,
      })
      acc[edge.source] = current
      return acc
    }, {})

    const byId = new Map(nodes.map((n) => [n.id, n]))

    const payload = {
      meta: {
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
      },
      graph: {
        nodes: nodes.map((node) => {
          const parentId = node.parentNode ?? null
          const parent = parentId ? byId.get(parentId) : null
          const groupName =
            parentId && parent?.type === 'group'
              ? (parent.data?.label ?? parent.id)
              : null

          let data
          if (node.type === 'dialogue') {
            data = {
              kind: node.data?.kind ?? 'dialogue',
              title: node.data?.title ?? '',
              character: node.data?.character ?? '',
              text: node.data?.text ?? '',
              customProperties: node.data?.customProperties ?? [],
            }
          } else if (node.type === 'logic') {
            data = {
              kind: node.data?.kind ?? 'logic',
              title: node.data?.title ?? '',
              operations: node.data?.operations ?? [],
            }
          } else if (node.type === 'branch') {
            data = {
              kind: node.data?.kind ?? 'branch',
              title: node.data?.title ?? '',
              condition: node.data?.condition ?? {
                variable: '',
                operator: '==',
                value: '',
              },
            }
          } else if (node.type === 'group') {
            data = {
              kind: node.data?.kind ?? 'group',
              title: node.data?.title ?? '',
              label: node.data?.label ?? '',
              width: parseDim(node.style?.width, 520),
              height: parseDim(node.style?.height, 380),
            }
          } else if (node.type === 'event') {
            data = {
              kind: node.data?.kind ?? 'event',
              title: node.data?.title ?? '',
              body: node.data?.body ?? '',
            }
          } else if (node.type === 'choice') {
            data = {
              kind: node.data?.kind ?? 'choice',
              title: node.data?.title ?? '',
              body: node.data?.body ?? '',
              options: node.data?.options ?? [],
            }
          } else {
            data = {}
          }

          return {
            id: node.id,
            type: node.type,
            parentId,
            groupName,
            position: {
              x: Number(node.position?.x ?? 0),
              y: Number(node.position?.y ?? 0),
            },
            data,
            outputs: outputMap[node.id] ?? [],
          }
        }),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          label: edge.label ?? null,
          type: edge.type ?? 'default',
        })),
      },
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'chat_on_data.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }, [edges, nodes])

  return (
    <EditorGraphProvider value={{ mergeNodeData }}>
      <div className="editor-app-root">
        <EditorLayout
          nodes={nodesForFlow}
          edges={edgesForFlow}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={(event, node) => {
            if (!quickConnectMode) return
            event.preventDefault()
            if (!quickConnectSourceId) {
              setQuickConnectSourceId(node.id)
              return
            }

            quickConnectNodes(quickConnectSourceId, node.id)
            setQuickConnectSourceId(node.id)
          }}
          onSelectionChange={handleFlowSelectionChange}
          currentProjectName={currentProjectName}
          projectList={projectList}
          activeProjectId={activeProjectId}
          onSwitchProject={switchToProject}
          onNewProject={handleNewProject}
          onRenameProject={handleRenameProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          addNodeByType={addNodeByType}
          quickConnectMode={quickConnectMode}
          setQuickConnectMode={setQuickConnectMode}
          branchConnectPath={branchConnectPath}
          setBranchConnectPath={setBranchConnectPath}
          quickConnectSourceId={quickConnectSourceId}
          setQuickConnectSourceId={setQuickConnectSourceId}
          deleteSelected={deleteSelected}
          downloadJson={downloadJson}
          selectedNode={selectedNode}
          mergeNodeData={mergeNodeData}
          addInspectorRow={addInspectorRow}
          updateInspectorRow={updateInspectorRow}
          removeInspectorRow={removeInspectorRow}
          deleteNodesByIds={deleteNodesByIds}
          deleteEdgesByIds={deleteEdgesByIds}
          onClearFlowSelection={clearFlowSelection}
          onFocusNodeInInspector={focusNodeInInspector}
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          toast={toast}
        />
      </div>
    </EditorGraphProvider>
  )
}

function LocalEditorApp() {
  const [boot] = useState(() => getBootState())
  const [nodes, setNodes, onNodesChange] = useNodesState(boot.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(boot.edges)
  return (
    <EditorBody
      boot={boot}
      nodes={nodes}
      edges={edges}
      setNodes={setNodes}
      setEdges={setEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      persistOnGraphChange
      promptBeforeProjectSwitch={false}
    />
  )
}

function CollabEditorApp() {
  const [boot] = useState(() => getBootState())
  /** 스토리지 로드 여부(스냅샷 null) */
  const storageRoot = useStorage((root) => root)
  /**
   * nodes / edges를 각각 구독해 LiveMap 내부 변경이 항상 React로 전달되게 함.
   * (루트 객체만 선택하는 방식은 환경에 따라 갱신이 누락될 수 있음)
   */
  const storageNodesRecord = useStorage(
    (root) => root?.nodes ?? null,
    storageRecordJsonEqual,
  )
  const storageEdgesRecord = useStorage(
    (root) => root?.edges ?? null,
    storageRecordJsonEqual,
  )
  const nodes = useMemo(
    () => storageRecordToNodes(storageNodesRecord ?? undefined),
    [storageNodesRecord],
  )
  const edges = useMemo(
    () => storageRecordToEdges(storageEdgesRecord ?? undefined),
    [storageEdgesRecord],
  )

  const setNodesMutation = useMutation(
    ({ storage }, updater) => {
      const { nodes: nm } = ensureGraphStorageMaps(storage)
      const next =
        typeof updater === 'function' ? updater(liveMapToSortedNodes(nm)) : updater
      syncNodesLiveMap(nm, next)
    },
    [],
  )
  const setEdgesMutation = useMutation(
    ({ storage }, updater) => {
      const { edges: em } = ensureGraphStorageMaps(storage)
      const next =
        typeof updater === 'function' ? updater(liveMapToEdges(em)) : updater
      syncEdgesLiveMap(em, next)
    },
    [],
  )
  const setNodes = useCallback((u) => setNodesMutation(u), [setNodesMutation])
  const setEdges = useCallback((u) => setEdgesMutation(u), [setEdgesMutation])

  const commitNodesChange = useMutation(
    ({ storage }, changes) => {
      const { nodes: nm } = ensureGraphStorageMaps(storage)
      let n = liveMapToSortedNodes(nm)
      n = applyNodeChanges(changes, n)
      syncNodesLiveMap(nm, n)
    },
    [],
  )
  const commitEdgesChange = useMutation(
    ({ storage }, changes) => {
      const { edges: em } = ensureGraphStorageMaps(storage)
      let e = liveMapToEdges(em)
      e = applyEdgeChanges(changes, e)
      syncEdgesLiveMap(em, e)
    },
    [],
  )
  const onNodesChangeCb = useCallback(
    (changes) => {
      const next = changesWithoutSelect(changes)
      if (next.length === 0) return
      commitNodesChange(next)
    },
    [commitNodesChange],
  )
  const onEdgesChangeCb = useCallback(
    (changes) => {
      const next = changesWithoutSelect(changes)
      if (next.length === 0) return
      commitEdgesChange(next)
    },
    [commitEdgesChange],
  )

  /** 노드·엣지 LiveMap이 모두 비어 있을 때만 샘플 그래프 시드 (기존 룸 데이터 덮어쓰기 금지) */
  const seedEmptyRoomGraph = useMutation(({ storage }) => {
    const { nodes: nm, edges: em } = ensureGraphStorageMaps(storage)
    if (liveMapToSortedNodes(nm).length > 0 || liveMapToEdges(em).length > 0) {
      return
    }
    const { nodes: seedNodes, edges: seedEdges } = getCollaborationSeedGraph()
    syncNodesLiveMap(nm, seedNodes)
    syncEdgesLiveMap(em, seedEdges)
  }, [])

  /** 깨진 position만 storage에 반영(내용 동일하면 mutation noop에 가깝게) */
  const repairStorageNodes = useMutation(({ storage }) => {
    repairLiveMapNodesIfNeeded(storage)
  }, [])

  const seedOnceRef = useRef(false)
  useEffect(() => {
    if (storageRoot === null) return
    if (seedOnceRef.current) return
    seedOnceRef.current = true
    seedEmptyRoomGraph()
    repairStorageNodes()
  }, [storageRoot, seedEmptyRoomGraph, repairStorageNodes])

  /**
   * storageRoot === null: 룸 스토리지가 아직 로드되지 않음.
   * 이 시점에 useMutation으로 storage에 접근하면 Liveblocks가
   * "storage has been loaded" 오류를 던져 모든 편집이 실패함.
   */
  if (storageRoot === null) {
    return (
      <div
        role="status"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '60vh',
          padding: 24,
          color: '#d8d0ff',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 16 }}>협업 저장소를 불러오는 중…</p>
          <p style={{ margin: '12px 0 0', fontSize: 13, opacity: 0.75 }}>
            준비되면 노드 편집·동기화가 가능합니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <EditorBody
      boot={boot}
      nodes={nodes}
      edges={edges}
      setNodes={setNodes}
      setEdges={setEdges}
      onNodesChange={onNodesChangeCb}
      onEdgesChange={onEdgesChangeCb}
      persistOnGraphChange={false}
      promptBeforeProjectSwitch
    />
  )
}

export default function App() {
  return COLLAB_ENABLED ? <CollabEditorApp /> : <LocalEditorApp />
}

