import { createContext, useContext } from 'react'

/**
 * 커스텀 노드에서 node.data 변경 시 Liveblocks(또는 로컬) setNodes 경로로 보내기 위한 컨텍스트.
 * useReactFlow().updateNodeData()는 controlled nodes(Liveblocks props)와 함께 쓰면 동기화되지 않음.
 */
const EditorGraphContext = createContext(null)

export function EditorGraphProvider({ value, children }) {
  return (
    <EditorGraphContext.Provider value={value}>{children}</EditorGraphContext.Provider>
  )
}

/** 훅은 컴포넌트가 아니므로 react-refresh 규칙 예외 */
// eslint-disable-next-line react-refresh/only-export-components -- context hook
export function useEditorGraph() {
  const ctx = useContext(EditorGraphContext)
  if (ctx == null) {
    throw new Error('useEditorGraph must be used within EditorGraphProvider')
  }
  return ctx
}
