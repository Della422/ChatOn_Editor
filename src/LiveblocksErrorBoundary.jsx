import { Component } from 'react'

export class LiveblocksErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[LiveblocksErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            maxWidth: 560,
            margin: '48px auto',
            background: '#2a1f3d',
            border: '1px solid #c084fc',
            borderRadius: 12,
            color: '#f5f3ff',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.6,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Liveblocks 렌더 오류</h2>
          <p style={{ margin: 0 }}>
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <p style={{ margin: '16px 0 0', opacity: 0.85, fontSize: 14 }}>
            콘솔에 자세한 스택이 출력됩니다. Public Key·룸 ID·네트워크를 확인하세요.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
