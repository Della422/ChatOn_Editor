import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'

function DialogueNode({ data }) {
  const { updateNodeData } = useReactFlow()

  const handleCharacterChange = useCallback(
    (event) => {
      updateNodeData(data.id, { character: event.target.value })
    },
    [data.id, updateNodeData],
  )

  const handleTextChange = useCallback(
    (event) => {
      updateNodeData(data.id, { text: event.target.value })
    },
    [data.id, updateNodeData],
  )

  const addProperty = useCallback(() => {
    const next = [...(data.customProperties ?? [])]
    next.push({
      id: `prop-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      key: '',
      value: '',
    })
    updateNodeData(data.id, { customProperties: next })
  }, [data.customProperties, data.id, updateNodeData])

  const removeProperty = useCallback(
    (propertyId) => {
      const next = (data.customProperties ?? []).filter(
        (property) => property.id !== propertyId,
      )
      updateNodeData(data.id, { customProperties: next })
    },
    [data.customProperties, data.id, updateNodeData],
  )

  const updateProperty = useCallback(
    (propertyId, field, value) => {
      const next = (data.customProperties ?? []).map((property) =>
        property.id === propertyId ? { ...property, [field]: value } : property,
      )
      updateNodeData(data.id, { customProperties: next })
    },
    [data.customProperties, data.id, updateNodeData],
  )

  return (
    <div className="dialogue-node">
      <Handle
        type="target"
        position={Position.Left}
        className="dialogue-node__handle"
      />

      <div className="dialogue-node__header">DIALOGUE</div>

      <label className="dialogue-node__label" htmlFor={`character-${data.id}`}>
        Character
      </label>
      <input
        id={`character-${data.id}`}
        className="dialogue-node__input"
        type="text"
        value={data.character ?? ''}
        onChange={handleCharacterChange}
        placeholder="발화자"
      />

      <label className="dialogue-node__label" htmlFor={`text-${data.id}`}>
        Text
      </label>
      <textarea
        id={`text-${data.id}`}
        className="dialogue-node__textarea"
        value={data.text ?? ''}
        onChange={handleTextChange}
        placeholder="대사를 입력하세요..."
        rows={5}
      />

      <div className="dialogue-node__subheader">Custom Properties</div>
      <button type="button" className="node-mini-button" onClick={addProperty}>
        + 커스텀 속성 추가
      </button>
      <div className="node-list">
        {(data.customProperties ?? []).map((property) => (
          <div key={property.id} className="node-list-row">
            <input
              className="dialogue-node__input"
              type="text"
              value={property.key ?? ''}
              onChange={(event) =>
                updateProperty(property.id, 'key', event.target.value)
              }
              placeholder="Key"
            />
            <input
              className="dialogue-node__input"
              type="text"
              value={property.value ?? ''}
              onChange={(event) =>
                updateProperty(property.id, 'value', event.target.value)
              }
              placeholder="Value"
            />
            <button
              type="button"
              className="node-mini-button node-mini-button--danger"
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
