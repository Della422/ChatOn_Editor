import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LiveMap } from '@liveblocks/client'
import { LiveblocksProvider, RoomProvider } from '@liveblocks/react'
import './index.css'
import App from './App.jsx'
import { LiveblocksConnectionBanner } from './LiveblocksConnectionBanner.jsx'
import { LiveblocksErrorBoundary } from './LiveblocksErrorBoundary.jsx'
import { DEFAULT_LIVEBLOCKS_ROOM_ID, getRoomIdFromUrl } from './roomId.js'

const publicKeyRaw = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY
const liveblocksPublicKey =
  typeof publicKeyRaw === 'string' ? publicKeyRaw.trim() : ''

let roomId = getRoomIdFromUrl()
if (typeof roomId !== 'string' || roomId.trim() === '') {
  roomId = DEFAULT_LIVEBLOCKS_ROOM_ID
} else {
  roomId = roomId.trim()
}

if (import.meta.env.DEV) {
  console.log('Liveblocks key exists:', Boolean(liveblocksPublicKey))
  console.log(
    'Liveblocks key prefix:',
    liveblocksPublicKey ? liveblocksPublicKey.slice(0, 8) : '(empty)',
  )
  console.log('roomId:', roomId)
}

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
      Liveblocks Public Key가 설정되지 않았습니다. .env.local에
      VITE_LIVEBLOCKS_PUBLIC_KEY를 추가하고 npm run dev를 다시 실행하세요.
    </div>
  ) : null

const editorRoot =
  liveblocksPublicKey !== '' ? (
    <LiveblocksProvider publicApiKey={liveblocksPublicKey}>
      <RoomProvider
        id={roomId}
        initialPresence={{ cursor: null }}
        initialStorage={{
          nodes: new LiveMap(),
          edges: new LiveMap(),
        }}
      >
        <LiveblocksErrorBoundary>
          <LiveblocksConnectionBanner>
            <App />
          </LiveblocksConnectionBanner>
        </LiveblocksErrorBoundary>
      </RoomProvider>
    </LiveblocksProvider>
  ) : (
    <App />
  )

const rootTree = (
  <div className="app-root-layout">
    {missingKeyBanner}
    <div className="app-root-layout__main">{editorRoot}</div>
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>{rootTree}</StrictMode>,
)
