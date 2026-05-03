import { useEffect, useState } from 'react'
import { useErrorListener, useStatus } from '@liveblocks/react'

/**
 * RoomProvider 안에서만 사용. 연결 지연·에러·끊김을 화면 상단에 표시합니다.
 */
export function LiveblocksConnectionBanner({ children }) {
  const status = useStatus()
  const [liveblocksError, setLiveblocksError] = useState(null)
  const [slowConnect, setSlowConnect] = useState(false)

  useErrorListener((error) => {
    setLiveblocksError(error.message)
  })

  useEffect(() => {
    if (status === 'connected') {
      setSlowConnect(false) // eslint-disable-line react-hooks/set-state-in-effect -- 연결되면 지연 경고 초기화
      return undefined
    }
    const id = window.setTimeout(() => setSlowConnect(true), 12000)
    return () => window.clearTimeout(id)
  }, [status])

  const showSlow =
    slowConnect &&
    (status === 'initial' || status === 'connecting' || status === 'reconnecting')

  const alertStyle = {
    flexShrink: 0,
    padding: '10px 16px',
    background: '#3d2a14',
    borderBottom: '1px solid #b45309',
    color: '#fff7ed',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
  }

  return (
    <>
      {liveblocksError && (
        <div role="alert" style={alertStyle}>
          <strong>Liveblocks 오류:</strong> {liveblocksError}
        </div>
      )}
      {!liveblocksError && showSlow && (
        <div role="status" style={alertStyle}>
          Liveblocks 서버 연결이 지연되고 있습니다. Public Key·방화벽·
          <code style={{ marginLeft: 4 }}>?room=</code> 값을 확인하세요.
        </div>
      )}
      {!liveblocksError && status === 'disconnected' && (
        <div role="alert" style={alertStyle}>
          Liveblocks 연결이 끊어졌습니다. 네트워크와 API Key를 확인한 뒤 새로고침하세요.
        </div>
      )}
      {children}
    </>
  )
}
