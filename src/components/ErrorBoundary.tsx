import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40, textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif',
          color: '#c0392b',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 20 }}>{this.state.error.message}</div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#1a3a6b', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
