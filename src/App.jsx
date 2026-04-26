import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MoonStar } from 'lucide-react'
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import BranchNode from './components/BranchNode'
import DialogueNode from './components/DialogueNode'
import GroupNode from './components/GroupNode'
import LogicNode from './components/LogicNode'
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
import 'reactflow/dist/style.css'

const nodeTypes = {
  dialogue: DialogueNode,
  logic: LogicNode,
  branch: BranchNode,
  group: GroupNode,
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
}

function createDefaultData(type, id) {
  if (type === 'logic') {
    return {
      id,
      operations: [{ id: randomId('op'), variable: '', operator: '=', value: '' }],
    }
  }
  if (type === 'branch') {
    return { id, condition: { variable: '', operator: '==', value: '' } }
  }
  if (type === 'group') {
    return { id, label: 'New Group' }
  }
  return { id, character: '', text: '', customProperties: [] }
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

function App() {
  const [boot] = useState(() => getBootState())
  const [nodes, setNodes, onNodesChange] = useNodesState(boot.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(boot.edges)
  const [activeProjectId, setActiveProjectId] = useState(boot.activeProjectId)
  const [projectList, setProjectList] = useState(boot.projectList)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
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

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1800)
  }, [])

  useEffect(() => {
    const store = loadProjectsStore()
    persistActiveProjectGraph(store, activeProjectId, nodes, edges)
    setProjectList(projectSummaries(store))
  }, [nodes, edges, activeProjectId])

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
  }, [])

  const deleteEdgesByIds = useCallback((edgeIds) => {
    if (!edgeIds.length) return
    const deleting = new Set(edgeIds)
    setEdges((current) => current.filter((edge) => !deleting.has(edge.id)))
  }, [])

  const deleteSelected = useCallback(() => {
    const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id)
    const selectedEdgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id)
    deleteNodesByIds(selectedNodeIds)
    deleteEdgesByIds(selectedEdgeIds)
    if (selectedNodeIds.includes(selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [deleteEdgesByIds, deleteNodesByIds, edges, nodes, selectedNodeId])

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
        setQuickConnectSourceId(null)
        showToast('다시 실행했습니다.')
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const selectedNodeIds = nodes.filter((node) => node.selected).map((n) => n.id)
      const selectedEdgeIds = edges.filter((edge) => edge.selected).map((e) => e.id)
      if (!selectedNodeIds.length && !selectedEdgeIds.length) return
      event.preventDefault()
      deleteSelected()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected, edges, nodes, setEdges, setNodes, showToast])

  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const addNodeByType = useCallback(
    (type) => {
      const id = randomId(type)
      const offset = nodes.length % 5
      setNodes((current) => {
        const base = {
          id,
          type,
          position: { x: 220 + offset * 220, y: 220 + offset * 110 },
          data: createDefaultData(type, id),
        }
        if (type === 'group') {
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
  }, [])

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

  const mergeNodeData = useCallback((nodeId, patch) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    )
  }, [])

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
  }, [])

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
  }, [])

  const removeInspectorRow = useCallback((nodeId, listKey, rowId) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId) return node
        const next = (node.data[listKey] ?? []).filter((row) => row.id !== rowId)
        return { ...node, data: { ...node.data, [listKey]: next } }
      }),
    )
  }, [])

  const currentProjectName = useMemo(
    () => projectList.find((p) => p.id === activeProjectId)?.name ?? '',
    [projectList, activeProjectId],
  )

  const switchToProject = useCallback(
    (newId) => {
      if (newId === activeProjectId) return
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
    [activeProjectId, edges, nodes],
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
  }, [activeProjectId, edges, nodes, projectList.length, showToast])

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
  }, [activeProjectId, edges, nodes, showToast])

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
  }, [activeProjectId, edges, nodes, showToast])

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
              character: node.data?.character ?? '',
              text: node.data?.text ?? '',
              customProperties: node.data?.customProperties ?? [],
            }
          } else if (node.type === 'logic') {
            data = { operations: node.data?.operations ?? [] }
          } else if (node.type === 'branch') {
            data = {
              condition: node.data?.condition ?? {
                variable: '',
                operator: '==',
                value: '',
              },
            }
          } else if (node.type === 'group') {
            data = {
              label: node.data?.label ?? '',
              width: parseDim(node.style?.width, 520),
              height: parseDim(node.style?.height, 380),
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
    <div className="editor-shell">
      <div className="editor-title">
        <MoonStar size={16} />
        <div className="editor-title__text">
          <span>Universal Narrative Node Editor</span>
          <small className="editor-title__project">{currentProjectName}</small>
        </div>
      </div>

      <div className="editor-project-bar">
        <span className="editor-project-bar__label">프로젝트</span>
        <select
          className="editor-project-bar__select"
          value={activeProjectId}
          onChange={(event) => switchToProject(event.target.value)}
          title="불러올 프로젝트 선택"
        >
          {projectList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleNewProject}>
          새 프로젝트
        </button>
        <button type="button" onClick={handleRenameProject}>
          이름 바꾸기
        </button>
        <button type="button" onClick={handleDuplicateProject}>
          복사해서 저장
        </button>
        <button
          type="button"
          className="editor-project-bar__danger"
          onClick={handleDeleteProject}
        >
          프로젝트 삭제
        </button>
      </div>

      <div className="editor-toolbar">
        <button type="button" onClick={() => addNodeByType('dialogue')}>
          + Dialogue
        </button>
        <button type="button" onClick={() => addNodeByType('logic')}>
          + Logic
        </button>
        <button type="button" onClick={() => addNodeByType('branch')}>
          + Branch
        </button>
        <button type="button" onClick={() => addNodeByType('group')}>
          + Group
        </button>
        <button
          type="button"
          className={quickConnectMode ? 'editor-toolbar__active' : ''}
          onClick={() => {
            setQuickConnectMode((prev) => !prev)
            setQuickConnectSourceId(null)
          }}
        >
          {quickConnectMode ? '연결 모드 ON' : '연결 쉽게 하기'}
        </button>
        {quickConnectMode && (
          <select
            value={branchConnectPath}
            onChange={(event) => setBranchConnectPath(event.target.value)}
            title="Branch 노드 출구 선택"
          >
            <option value="true">Branch True로 연결</option>
            <option value="false">Branch False로 연결</option>
          </select>
        )}
        <button type="button" onClick={deleteSelected}>
          선택 삭제
        </button>
        {quickConnectMode && (
          <span className="editor-toolbar__hint">
            {quickConnectSourceId
              ? `출발 노드: ${quickConnectSourceId} (다음 노드 클릭으로 연결)`
              : '출발 노드를 먼저 클릭하세요'}
          </span>
        )}
        <button
          type="button"
          className="editor-toolbar__download"
          onClick={downloadJson}
        >
          JSON 다운로드
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        onSelectionChange={({ nodes: selectedNodes }) => {
          setSelectedNodeId(selectedNodes[0]?.id ?? null)
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault()
          event.stopPropagation()
          setContextMenu({
            type: 'node',
            nodeId: node.id,
            x: event.clientX,
            y: event.clientY,
          })
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault()
          event.stopPropagation()
          setContextMenu({
            type: 'edge',
            edgeId: edge.id,
            x: event.clientX,
            y: event.clientY,
          })
        }}
        onPaneClick={() => {
          setContextMenu(null)
          setSelectedNodeId(null)
        }}
        fitView
        minZoom={0.3}
        maxZoom={1.8}
        colorMode="dark"
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#7b61ff', strokeWidth: 2 },
        }}
      >
        <Background color="#2f2a45" gap={24} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) =>
            node.type === 'group'
              ? '#5c6b8a'
              : node.type === 'branch'
                ? '#c66bff'
                : node.type === 'logic'
                  ? '#6bb5ff'
                  : '#6a5acd'
          }
          maskColor="rgba(5, 3, 12, 0.65)"
          style={{ backgroundColor: '#0d0b16', border: '1px solid #30294d' }}
        />
        <Controls
          style={{ backgroundColor: '#0d0b16', border: '1px solid #30294d' }}
        />
      </ReactFlow>

      <aside className={`inspector-panel ${selectedNode ? 'is-open' : ''}`}>
        <h3>Inspector</h3>
        {!selectedNode && (
          <p className="inspector-empty">
            노드를 선택하면 상세 속성을 편집할 수 있습니다.
          </p>
        )}
        {selectedNode && (
          <div className="inspector-section">
            <div className="inspector-meta">
              <span>{selectedNode.type.toUpperCase()}</span>
              <small>{selectedNode.id}</small>
            </div>
            <button
              type="button"
              className="inspector-delete-button"
              onClick={() => {
                deleteNodesByIds([selectedNode.id])
                setSelectedNodeId(null)
              }}
            >
              이 노드 삭제
            </button>

            {selectedNode.type === 'group' && (
              <>
                <label>그룹 이름 (Scene / Chapter)</label>
                <input
                  value={selectedNode.data.label ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { label: event.target.value })
                  }
                  placeholder="예: Scene 1 — 연구소"
                />
                <p className="inspector-hint">
                  다른 노드를 박스 안으로 드래그하면 이 그룹에 속합니다. 그룹을
                  움직이면 안의 노드도 함께 이동합니다. 우측 하단 핸들로 크기를
                  조절하세요.
                </p>
              </>
            )}

            {selectedNode.type === 'dialogue' && (
              <>
                <label>Character</label>
                <input
                  value={selectedNode.data.character ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { character: event.target.value })
                  }
                />
                <label>Text</label>
                <textarea
                  rows={6}
                  value={selectedNode.data.text ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { text: event.target.value })
                  }
                />

                <div className="inspector-subtitle">Custom Properties</div>
                {(selectedNode.data.customProperties ?? []).map((property) => (
                  <div key={property.id} className="inspector-row">
                    <input
                      value={property.key ?? ''}
                      placeholder="Key"
                      onChange={(event) =>
                        updateInspectorRow(
                          selectedNode.id,
                          'customProperties',
                          property.id,
                          'key',
                          event.target.value,
                        )
                      }
                    />
                    <input
                      value={property.value ?? ''}
                      placeholder="Value"
                      onChange={(event) =>
                        updateInspectorRow(
                          selectedNode.id,
                          'customProperties',
                          property.id,
                          'value',
                          event.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        removeInspectorRow(
                          selectedNode.id,
                          'customProperties',
                          property.id,
                        )
                      }
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    addInspectorRow(selectedNode.id, 'customProperties', {
                      key: '',
                      value: '',
                    })
                  }
                >
                  + 커스텀 속성 추가
                </button>
              </>
            )}

            {selectedNode.type === 'logic' && (
              <>
                <div className="inspector-subtitle">Operations</div>
                {(selectedNode.data.operations ?? []).map((operation) => (
                  <div key={operation.id} className="inspector-row inspector-row--triple">
                    <input
                      value={operation.variable ?? ''}
                      placeholder="변수명"
                      onChange={(event) =>
                        updateInspectorRow(
                          selectedNode.id,
                          'operations',
                          operation.id,
                          'variable',
                          event.target.value,
                        )
                      }
                    />
                    <select
                      value={operation.operator ?? '='}
                      onChange={(event) =>
                        updateInspectorRow(
                          selectedNode.id,
                          'operations',
                          operation.id,
                          'operator',
                          event.target.value,
                        )
                      }
                    >
                      <option value="=">=</option>
                      <option value="+=">+=</option>
                      <option value="-=">-=</option>
                    </select>
                    <input
                      value={operation.value ?? ''}
                      placeholder="값"
                      onChange={(event) =>
                        updateInspectorRow(
                          selectedNode.id,
                          'operations',
                          operation.id,
                          'value',
                          event.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        removeInspectorRow(selectedNode.id, 'operations', operation.id)
                      }
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    addInspectorRow(selectedNode.id, 'operations', {
                      variable: '',
                      operator: '=',
                      value: '',
                    })
                  }
                >
                  + 변수 연산 추가
                </button>
              </>
            )}

            {selectedNode.type === 'branch' && (
              <>
                <label>Variable</label>
                <input
                  value={selectedNode.data.condition?.variable ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, {
                      condition: {
                        ...(selectedNode.data.condition ?? {}),
                        variable: event.target.value,
                      },
                    })
                  }
                />
                <label>Operator</label>
                <select
                  value={selectedNode.data.condition?.operator ?? '=='}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, {
                      condition: {
                        ...(selectedNode.data.condition ?? {}),
                        operator: event.target.value,
                      },
                    })
                  }
                >
                  <option value="==">==</option>
                  <option value="!=">!=</option>
                  <option value=">=">{'>='}</option>
                  <option value="<=">{'<='}</option>
                </select>
                <label>Value</label>
                <input
                  value={selectedNode.data.condition?.value ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, {
                      condition: {
                        ...(selectedNode.data.condition ?? {}),
                        value: event.target.value,
                      },
                    })
                  }
                />
              </>
            )}
          </div>
        )}
      </aside>

      {contextMenu && (
        <div
          className="editor-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'edge' ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                deleteEdgesByIds([contextMenu.edgeId])
                setContextMenu(null)
              }}
            >
              연결선 삭제
            </button>
          ) : (
            <>
              <div className="editor-context-menu__hint">
                노드 삭제는 실수 방지를 위해 Inspector/선택 삭제에서 진행하세요.
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedNodeId(contextMenu.nodeId)
                  setContextMenu(null)
                }}
              >
                Inspector에서 편집
              </button>
            </>
          )}
        </div>
      )}
      {toast && <div className="editor-toast">{toast}</div>}
    </div>
  )
}

export default App
