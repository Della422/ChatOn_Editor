import { useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { useEditorGraph } from '../EditorGraphContext.jsx'
import { NODE_INNER_STOP_PROPAGATION, withNoDragNoPan } from '../nodeCanvasInputProps.js'

function BranchNode({ id, data }) {
  const { mergeNodeData } = useEditorGraph()
  const nodeId = id ?? data.id
  const condition = data.condition ?? {
    variable: '',
    operator: '==',
    value: '',
  }

  const updateCondition = useCallback(
    (field, value) => {
      mergeNodeData(nodeId, {
        condition: {
          ...condition,
          [field]: value,
        },
      })
    },
    [condition, nodeId, mergeNodeData],
  )

  return (
    <div className="branch-node">
      <Handle type="target" position={Position.Left} className="dialogue-node__handle" />
      <div className="dialogue-node__header">BRANCH</div>
      <label className="dialogue-node__label">Condition</label>
      <div className="node-list-row node-list-row--inline">
        <input
          {...NODE_INNER_STOP_PROPAGATION}
          className={withNoDragNoPan('dialogue-node__input')}
          value={condition.variable ?? ''}
          onChange={(event) => updateCondition('variable', event.target.value)}
          placeholder="변수명"
        />
        <select
          {...NODE_INNER_STOP_PROPAGATION}
          className={withNoDragNoPan('dialogue-node__input')}
          value={condition.operator ?? '=='}
          onChange={(event) => updateCondition('operator', event.target.value)}
        >
          <option value="==">==</option>
          <option value="!=">!=</option>
          <option value=">=">{'>='}</option>
          <option value="<=">{'<='}</option>
        </select>
        <input
          {...NODE_INNER_STOP_PROPAGATION}
          className={withNoDragNoPan('dialogue-node__input')}
          value={condition.value ?? ''}
          onChange={(event) => updateCondition('value', event.target.value)}
          placeholder="값"
        />
      </div>
      <div className="branch-node__port-label branch-node__port-label--true">TRUE</div>
      <div className="branch-node__port-label branch-node__port-label--false">FALSE</div>
      <Handle
        id="true"
        type="source"
        position={Position.Right}
        className="dialogue-node__handle branch-node__handle--true"
        style={{ top: '38%' }}
      />
      <Handle
        id="false"
        type="source"
        position={Position.Right}
        className="dialogue-node__handle branch-node__handle--false"
        style={{ top: '68%' }}
      />
    </div>
  )
}

export default BranchNode
