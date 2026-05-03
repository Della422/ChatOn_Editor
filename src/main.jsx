import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LiveMap } from '@liveblocks/client'
import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from '@liveblocks/react/suspense'
import './index.css'
import App from './App.jsx'
import { getRoomIdFromUrl } from './roomId.js'

const liveblocksPublicKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY?.trim() ?? ''
const roomId = getRoomIdFromUrl()

const suspenseFallback = (
  <div
    style={{
      display: 'grid',
      placeItems: 'center',
      minHeight: '100vh',
      background: '#07050f',
      color: '#d8d0ff',
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    Loading room…
  </div>
)

const missingKeyBanner =
  liveblocksPublicKey === '' ? (
    <div
      role="status"
      className="liveblocks-key-banner"
      style={{
        flexShrink: 0,
        padding: '12px 16px',
        background: '#2a1f3d',
        borderBottom: '1px solid #5c4d7a',
        color: '#e8e0ff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <strong>Liveblocks Public Key가 설정되지 않았습니다.</strong> 동시 편집(공유
      룸)은 비활성화되며 로컬 편집만 사용됩니다. 프로젝트 루트에{' '}
      <code style={{ color: '#c4b5fd' }}>.env.local</code> 파일을 만들고{' '}
      <code style={{ color: '#c4b5fd' }}>.env.example</code>을 참고해{' '}
      <code style={{ color: '#c4b5fd' }}>VITE_LIVEBLOCKS_PUBLIC_KEY</code>를 넣은 뒤{' '}
      개발 서버를 다시 시작하세요.
    </div>
  ) : null

const editorRoot =
  liveblocksPublicKey !== '' ? (
    <LiveblocksProvider publicApiKey={liveblocksPublicKey}>
      <ClientSideSuspense fallback={suspenseFallback}>
        <RoomProvider
          id={roomId}
          initialPresence={{ cursor: null }}
          initialStorage={{
            nodes: new LiveMap(),
            edges: new LiveMap(),
          }}
        >
          <App />
        </RoomProvider>
      </ClientSideSuspense>
    </LiveblocksProvider>
  ) : (
    <App />
  )

const rootTree = (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    {missingKeyBanner}
    <div style={{ flex: 1, minHeight: 0 }}>{editorRoot}</div>
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>{rootTree}</StrictMode>,
)
