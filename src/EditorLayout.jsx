import { useEffect, useMemo, useRef } from 'react'
import { MoonStar } from 'lucide-react'
import { Background, Controls, MiniMap, ReactFlow, useReactFlow } from 'reactflow'
import { EDITOR_EDGE_TYPES, EDITOR_NODE_TYPES } from './editorFlowTypes.js'
import 'reactflow/dist/style.css'

/** 첫 그래프 로드 시에만 fitView (fitView prop은 노드 갱신마다 재실행되어 렉·선택 깨짐 유발 가능) */
function OneShotFitView({ ready }) {
  const { fitView } = useReactFlow()
  const doneRef = useRef(false)
  useEffect(() => {
    if (!ready || doneRef.current) return
    doneRef.current = true
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.15 })
    })
    return () => cancelAnimationFrame(id)
  }, [ready, fitView])
  return null
}

/**
 * @param {Object} props
 * @param {import('reactflow').Node[]} props.nodes
 * @param {import('reactflow').Edge[]} props.edges
 * @param {import('reactflow').OnNodesChange} props.onNodesChange
 * @param {import('reactflow').OnEdgesChange} props.onEdgesChange
 * @param {import('reactflow').OnConnect} props.onConnect
 * @param {import('reactflow').NodeDragHandler} props.onNodeDragStop
 * @param {import('reactflow').NodeMouseHandler} props.onNodeClick
 * @param {import('reactflow').OnSelectionChangeFunc} props.onSelectionChange
 * @param {string} props.currentProjectName
 * @param {Array<{ id: string, name: string }>} props.projectList
 * @param {string} props.activeProjectId
 * @param {(id: string) => void} props.onSwitchProject
 * @param {() => void} props.onNewProject
 * @param {() => void} props.onRenameProject
 * @param {() => void} props.onDuplicateProject
 * @param {() => void} props.onDeleteProject
 * @param {(type: string) => void} props.addNodeByType
 * @param {boolean} props.quickConnectMode
 * @param {(v: boolean | ((b: boolean) => boolean)) => void} props.setQuickConnectMode
 * @param {string} props.branchConnectPath
 * @param {(v: string) => void} props.setBranchConnectPath
 * @param {string | null} props.quickConnectSourceId
 * @param {(v: string | null) => void} props.setQuickConnectSourceId
 * @param {() => void} props.deleteSelected
 * @param {() => void} props.downloadJson
 * @param {import('reactflow').Node | null} props.selectedNode
 * @param {(id: string, patch: object) => void} props.mergeNodeData
 * @param {(id: string, listKey: string, seed: object) => void} props.addInspectorRow
 * @param {(id: string, listKey: string, rowId: string, field: string, value: string) => void} props.updateInspectorRow
 * @param {(id: string, listKey: string, rowId: string) => void} props.removeInspectorRow
 * @param {(ids: string[]) => void} props.deleteNodesByIds
 * @param {(ids: string[]) => void} props.deleteEdgesByIds
 * @param {() => void} props.onClearFlowSelection
 * @param {(nodeId: string) => void} props.onFocusNodeInInspector
 * @param {{ type: 'node' | 'edge', nodeId?: string, edgeId?: string, x: number, y: number } | null} props.contextMenu
 * @param {(m: null | object) => void} props.setContextMenu
 * @param {string | null} props.toast
 * @param {string} [props.subtitle]
 */
export default function EditorLayout({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDragStop,
  onNodeClick,
  onSelectionChange,
  currentProjectName,
  projectList,
  activeProjectId,
  onSwitchProject,
  onNewProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  addNodeByType,
  quickConnectMode,
  setQuickConnectMode,
  branchConnectPath,
  setBranchConnectPath,
  quickConnectSourceId,
  setQuickConnectSourceId,
  deleteSelected,
  downloadJson,
  selectedNode,
  mergeNodeData,
  addInspectorRow,
  updateInspectorRow,
  removeInspectorRow,
  deleteNodesByIds,
  deleteEdgesByIds,
  onClearFlowSelection,
  onFocusNodeInInspector,
  contextMenu,
  setContextMenu,
  toast,
  subtitle = 'Universal Narrative Node Editor',
}) {
  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      style: { stroke: '#7b61ff', strokeWidth: 2 },
    }),
    [],
  )

  const minimapNodeColor = useMemo(
    () => (node) =>
      node.type === 'group'
        ? '#5c6b8a'
        : node.type === 'branch'
          ? '#c66bff'
          : node.type === 'logic'
            ? '#6bb5ff'
            : node.type === 'event'
              ? '#e6a23c'
              : node.type === 'choice'
                ? '#f06292'
                : '#6a5acd',
    [],
  )

  const minimapStyle = useMemo(
    () => ({
      backgroundColor: '#0d0b16',
      border: '1px solid #30294d',
    }),
    [],
  )
  const controlsStyle = useMemo(
    () => ({
      backgroundColor: '#0d0b16',
      border: '1px solid #30294d',
    }),
    [],
  )

  return (
    <div className="editor-shell">
      <div className="editor-title">
        <MoonStar size={16} />
        <div className="editor-title__text">
          <span>{subtitle}</span>
          <small className="editor-title__project">{currentProjectName}</small>
        </div>
      </div>

      <div className="editor-project-bar">
        <span className="editor-project-bar__label">프로젝트</span>
        <select
          className="editor-project-bar__select"
          value={activeProjectId}
          onChange={(event) => onSwitchProject(event.target.value)}
          title="불러올 프로젝트 선택"
        >
          {projectList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={onNewProject}>
          새 프로젝트
        </button>
        <button type="button" onClick={onRenameProject}>
          이름 바꾸기
        </button>
        <button type="button" onClick={onDuplicateProject}>
          복사해서 저장
        </button>
        <button
          type="button"
          className="editor-project-bar__danger"
          onClick={onDeleteProject}
        >
          프로젝트 삭제
        </button>
      </div>

      <div className="editor-toolbar">
        <button type="button" onClick={() => addNodeByType('branch')}>
          + Branch
        </button>
        <button type="button" onClick={() => addNodeByType('dialogue')}>
          + Dialogue
        </button>
        <button type="button" onClick={() => addNodeByType('event')}>
          + Event
        </button>
        <button type="button" onClick={() => addNodeByType('choice')}>
          + Choice
        </button>
        <button type="button" onClick={() => addNodeByType('logic')}>
          + Logic
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

      <div className="editor-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={EDITOR_NODE_TYPES}
          edgeTypes={EDITOR_EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onSelectionChange={onSelectionChange}
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
          }}
          nodesDraggable
          nodesConnectable
          nodesFocusable
          elementsSelectable
          minZoom={0.3}
          maxZoom={1.8}
          defaultEdgeOptions={defaultEdgeOptions}
        >
          <OneShotFitView ready={nodes.length > 0} />
          <Background color="#2f2a45" gap={24} size={1} />
          <MiniMap
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            maskColor="rgba(5, 3, 12, 0.65)"
            style={minimapStyle}
          />
          <Controls style={controlsStyle} />
        </ReactFlow>
      </div>

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
                onClearFlowSelection()
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
                <label>제목 (메타)</label>
                <input
                  value={selectedNode.data.title ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { title: event.target.value })
                  }
                  placeholder="노드 라벨"
                />
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

            {selectedNode.type === 'event' && (
              <>
                <label>제목</label>
                <input
                  value={selectedNode.data.title ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { title: event.target.value })
                  }
                />
                <label>본문</label>
                <textarea
                  rows={5}
                  value={selectedNode.data.body ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { body: event.target.value })
                  }
                />
              </>
            )}

            {selectedNode.type === 'choice' && (
              <>
                <label>제목</label>
                <input
                  value={selectedNode.data.title ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { title: event.target.value })
                  }
                />
                <label>안내 문구</label>
                <textarea
                  rows={3}
                  value={selectedNode.data.body ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { body: event.target.value })
                  }
                />
                <div className="inspector-subtitle">선택지</div>
                {(selectedNode.data.options ?? []).map((opt) => (
                  <div key={opt.id} className="inspector-row">
                    <input
                      value={opt.label ?? ''}
                      placeholder="선택 문구"
                      onChange={(event) =>
                        updateInspectorRow(
                          selectedNode.id,
                          'options',
                          opt.id,
                          'label',
                          event.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        removeInspectorRow(selectedNode.id, 'options', opt.id)
                      }
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    addInspectorRow(selectedNode.id, 'options', { label: '' })
                  }
                >
                  + 선택지 추가
                </button>
              </>
            )}

            {selectedNode.type === 'logic' && (
              <>
                <label>제목 (메타)</label>
                <input
                  value={selectedNode.data.title ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { title: event.target.value })
                  }
                />
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
                <label>제목 (메타)</label>
                <input
                  value={selectedNode.data.title ?? ''}
                  onChange={(event) =>
                    mergeNodeData(selectedNode.id, { title: event.target.value })
                  }
                />
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
                  onFocusNodeInInspector(contextMenu.nodeId)
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
