import { memo, useCallback } from 'react'
import { NodeResizer } from 'reactflow'
import { useEditorGraph } from '../EditorGraphContext.jsx'
import { NODE_INNER_STOP_PROPAGATION, withNoDragNoPan } from '../nodeCanvasInputProps.js'

function GroupNode({ id, data, selected }) {
  const { mergeNodeData } = useEditorGraph()

  const onLabelChange = useCallback(
    (event) => {
      mergeNodeData(id, { label: event.target.value })
    },
    [id, mergeNodeData],
  )

  return (
    <div className="group-node">
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={200}
        lineClassName="group-node__resize-line"
        handleClassName="group-node__resize-handle"
      />
      <div className="group-node__header">
        <span className="group-node__badge">GROUP</span>
        <input
          {...NODE_INNER_STOP_PROPAGATION}
          className={withNoDragNoPan('group-node__title-input')}
          type="text"
          value={data.label ?? ''}
          onChange={onLabelChange}
          placeholder="Scene / Chapter 이름"
        />
      </div>
    </div>
  )
}

export default memo(GroupNode)
