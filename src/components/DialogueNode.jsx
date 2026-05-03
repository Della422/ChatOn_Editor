import { useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { useEditorGraph } from '../EditorGraphContext.jsx'
import { NODE_INNER_STOP_PROPAGATION, withNoDragNoPan } from '../nodeCanvasInputProps.js'

function DialogueNode({ id, data }) {
  const { mergeNodeData } = useEditorGraph()
  const nodeId = id ?? data.id

  const handleCharacterChange = useCallback(
    (event) => {
      mergeNodeData(nodeId, { character: event.target.value })
    },
    [nodeId, mergeNodeData],
  )

  const handleTextChange = useCallback(
    (event) => {
      mergeNodeData(nodeId, { text: event.target.value })
    },
    [nodeId, mergeNodeData],
  )

  const addProperty = useCallback(() => {
    const next = [...(data.customProperties ?? [])]
    next.push({
      id: `prop-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      key: '',
      value: '',
    })
    mergeNodeData(nodeId, { customProperties: next })
  }, [data.customProperties, nodeId, mergeNodeData])

  const removeProperty = useCallback(
    (propertyId) => {
      const next = (data.customProperties ?? []).filter(
        (property) => property.id !== propertyId,
      )
      mergeNodeData(nodeId, { customProperties: next })
    },
    [data.customProperties, nodeId, mergeNodeData],
  )

  const updateProperty = useCallback(
    (propertyId, field, value) => {
      const next = (data.customProperties ?? []).map((property) =>
        property.id === propertyId ? { ...property, [field]: value } : property,
      )
      mergeNodeData(nodeId, { customProperties: next })
    },
    [data.customProperties, nodeId, mergeNodeData],
  )

  return (
    <div className="dialogue-node">
      <Handle
        type="target"
        position={Position.Left}
        className="dialogue-node__handle"
      />

      <div className="dialogue-node__header">DIALOGUE</div>

      <label className="dialogue-node__label" htmlFor={`character-${nodeId}`}>
        Character
      </label>
      <input
        {...NODE_INNER_STOP_PROPAGATION}
        id={`character-${nodeId}`}
        className={withNoDragNoPan('dialogue-node__input')}
        type="text"
        value={data.character ?? ''}
        onChange={handleCharacterChange}
        placeholder="발화자"
      />

      <label className="dialogue-node__label" htmlFor={`text-${nodeId}`}>
        Text
      </label>
      <textarea
        {...NODE_INNER_STOP_PROPAGATION}
        id={`text-${nodeId}`}
        className={withNoDragNoPan('dialogue-node__textarea')}
        value={data.text ?? ''}
        onChange={handleTextChange}
        placeholder="대사를 입력하세요..."
        rows={5}
      />

      <div className="dialogue-node__subheader">Custom Properties</div>
      <button
        type="button"
        {...NODE_INNER_STOP_PROPAGATION}
        className={withNoDragNoPan('node-mini-button')}
        onClick={addProperty}
      >
        + 커스텀 속성 추가
      </button>
      <div className="node-list">
        {(data.customProperties ?? []).map((property) => (
          <div key={property.id} className="node-list-row">
            <input
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('dialogue-node__input')}
              type="text"
              value={property.key ?? ''}
              onChange={(event) =>
                updateProperty(property.id, 'key', event.target.value)
              }
              placeholder="Key"
            />
            <input
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('dialogue-node__input')}
              type="text"
              value={property.value ?? ''}
              onChange={(event) =>
                updateProperty(property.id, 'value', event.target.value)
              }
              placeholder="Value"
            />
            <button
              type="button"
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('node-mini-button node-mini-button--danger')}
              onClick={() => removeProperty(property.id)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="dialogue-node__handle"
      />
    </div>
  )
}

export default DialogueNode
