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

const rootTree =
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

createRoot(document.getElementById('root')).render(
  <StrictMode>{rootTree}</StrictMode>,
)
