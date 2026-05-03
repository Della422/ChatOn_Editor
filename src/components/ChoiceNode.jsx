import { useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { useEditorGraph } from '../EditorGraphContext.jsx'
import { NODE_INNER_STOP_PROPAGATION, withNoDragNoPan } from '../nodeCanvasInputProps.js'

function ChoiceNode({ id, data }) {
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

  const addOption = useCallback(() => {
    const next = [...(data.options ?? [])]
    next.push({
      id: `opt-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      label: '',
    })
    mergeNodeData(nodeId, { options: next })
  }, [data.options, mergeNodeData, nodeId])

  const updateOption = useCallback(
    (optionId, label) => {
      const next = (data.options ?? []).map((o) =>
        o.id === optionId ? { ...o, label } : o,
      )
      mergeNodeData(nodeId, { options: next })
    },
    [data.options, mergeNodeData, nodeId],
  )

  const removeOption = useCallback(
    (optionId) => {
      const next = (data.options ?? []).filter((o) => o.id !== optionId)
      mergeNodeData(nodeId, { options: next })
    },
    [data.options, mergeNodeData, nodeId],
  )

  return (
    <div className="dialogue-node choice-node">
      <Handle type="target" position={Position.Left} className="dialogue-node__handle" />
      <div className="dialogue-node__header">CHOICE</div>
      <label className="dialogue-node__label" htmlFor={`ch-title-${nodeId}`}>
        제목
      </label>
      <input
        {...NODE_INNER_STOP_PROPAGATION}
        id={`ch-title-${nodeId}`}
        className={withNoDragNoPan('dialogue-node__input')}
        value={data.title ?? ''}
        onChange={onTitle}
        placeholder="선택지 묶음 제목"
      />
      <label className="dialogue-node__label" htmlFor={`ch-body-${nodeId}`}>
        안내 문구
      </label>
      <textarea
        {...NODE_INNER_STOP_PROPAGATION}
        id={`ch-body-${nodeId}`}
        className={withNoDragNoPan('dialogue-node__textarea')}
        value={data.body ?? ''}
        onChange={onBody}
        placeholder="플레이어에게 보일 설명"
        rows={3}
      />
      <div className="dialogue-node__subheader">선택지</div>
      <button
        type="button"
        {...NODE_INNER_STOP_PROPAGATION}
        className={withNoDragNoPan('node-mini-button')}
        onClick={addOption}
      >
        + 항목 추가
      </button>
      <div className="node-list">
        {(data.options ?? []).map((opt) => (
          <div key={opt.id} className="node-list-row">
            <input
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('dialogue-node__input')}
              value={opt.label ?? ''}
              onChange={(e) => updateOption(opt.id, e.target.value)}
              placeholder="선택 문구"
            />
            <button
              type="button"
              {...NODE_INNER_STOP_PROPAGATION}
              className={withNoDragNoPan('node-mini-button node-mini-button--danger')}
              onClick={() => removeOption(opt.id)}
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

export default ChoiceNode
