import { useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { useEditorGraph } from '../EditorGraphContext.jsx'
import { NODE_INNER_STOP_PROPAGATION, withNoDragNoPan } from '../nodeCanvasInputProps.js'

function EventNode({ id, data }) {
  const { mergeNodeData } = useEditorGraph()
  const nodeId = id ?? data.id

  const onTitle = useCallback(
    (event) => mergeNodeData(nodeId, { title: event.target.value }),
    [mergeNodeData, nodeId],
  )
  const onBody = useCallback(
    (event) => mergeNodeData(nodeId, { body: event.target.value }),
    [mergeNodeData, nodeId],
  )

  return (
    <div className="dialogue-node event-node">
      <Handle type="target" position={Position.Left} className="dialogue-node__handle" />
      <div className="dialogue-node__header">EVENT</div>
      <label className="dialogue-node__label" htmlFor={`evt-title-${nodeId}`}>
        제목
      </label>
      <input
        {...NODE_INNER_STOP_PROPAGATION}
        id={`evt-title-${nodeId}`}
        className={withNoDragNoPan('dialogue-node__input')}
        value={data.title ?? ''}
        onChange={onTitle}
        placeholder="이벤트 제목"
      />
      <label className="dialogue-node__label" htmlFor={`evt-body-${nodeId}`}>
        본문 / 메모
      </label>
      <textarea
        {...NODE_INNER_STOP_PROPAGATION}
        id={`evt-body-${nodeId}`}
        className={withNoDragNoPan('dialogue-node__textarea')}
        value={data.body ?? ''}
        onChange={onBody}
        placeholder="발생 조건·효과 등"
        rows={5}
      />
      <Handle type="source" position={Position.Right} className="dialogue-node__handle" />
    </div>
  )
}

export default EventNode
