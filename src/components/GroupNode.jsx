import { memo, useCallback } from 'react'
import { NodeResizer, useReactFlow } from 'reactflow'

function GroupNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()

  const onLabelChange = useCallback(
    (event) => {
      updateNodeData(id, { label: event.target.value })
    },
    [id, updateNodeData],
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
          className="group-node__title-input"
          type="text"
          value={data.label ?? ''}
          onChange={onLabelChange}
          placeholder="Scene / Chapter 이름"
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

export default memo(GroupNode)
