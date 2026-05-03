import { useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { useEditorGraph } from '../EditorGraphContext.jsx'
import { NODE_INNER_STOP_PROPAGATION, withNoDragNoPan } from '../nodeCanvasInputProps.js'

function LogicNode({ id, data }) {
  const { mergeNodeData } = useEditorGraph()
  const nodeId = id ?? data.id

  const addOperation = useCallback(() => {
    const next = [...(data.operations ?? [])]
    next.push({
      id: `op-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      variable: '',
      operator: '=',
      value: '',
    })
    mergeNodeData(nodeId, { operations: next })
  }, [nodeId, data.operations, mergeNodeData])

  const updateOperation = useCallback(
    (operationId, field, value) => {
      const next = (data.operations ?? []).map((operation) =>
        operation.id === operationId ? { ...operation, [field]: value } : operation,
      )
      mergeNodeData(nodeId, { operations: next })
    },
    [nodeId, data.operations, mergeNodeData],
  )

  const removeOperation = useCallback(
    (operationId) => {
      const next = (data.operations ?? []).filter(
        (operation) => operation.id !== operationId,
      )
      mergeNodeData(nodeId, { operations: next })
    },
    [nodeId, data.operations, mergeNodeData],
  )

  return (
    <div className="logic-node">
      <Handle type="target" position={Position.Left} className="dialogue-node__handle" />
      <div className="dialogue-node__header">LOGIC</div>
      <button
        type="button"
        {...NODE_INNER_STOP_PROPAGATION}
        className={withNoDragNoPan('node-mini-button')}
        onClick={addOperation}
      >
        + 변수 연산 추가
      </button>
      <div className="node-list">
        {(data.operations ?? []).map((operation) => (
          <div key={operation.id} className="node-list-row">
            <input
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('dialogue-node__input')}
              value={operation.variable ?? ''}
              onChange={(event) =>
                updateOperation(operation.id, 'variable', event.target.value)
              }
              placeholder="변수명"
            />
            <select
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('dialogue-node__input')}
              value={operation.operator ?? '='}
              onChange={(event) =>
                updateOperation(operation.id, 'operator', event.target.value)
              }
            >
              <option value="=">=</option>
              <option value="+=">+=</option>
              <option value="-=">-=</option>
            </select>
            <input
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('dialogue-node__input')}
              value={operation.value ?? ''}
              onChange={(event) =>
                updateOperation(operation.id, 'value', event.target.value)
              }
              placeholder="값"
            />
            <button
              type="button"
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('node-mini-button node-mini-button--danger')}
              onClick={() => removeOperation(operation.id)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="dialogue-node__handle" />
    </div>
  )
}

export default LogicNode
