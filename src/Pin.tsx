import { useState } from 'react'
import { setToken, checkAuth } from './lib/api'

interface Props {
  onUnlock: () => void
}

export default function Pin({ onUnlock }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function submit() {
    setChecking(true)
    setError('')
    setToken(pin)
    if (await checkAuth()) {
      onUnlock()
    } else {
      setError('Wrong PIN')
      setChecking(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: '#111827',
      padding: '20px',
      gap: '16px',
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f3f4f6' }}>NegotiateAI</h1>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && pin && submit()}
        placeholder="PIN"
        style={{
          fontSize: '24px',
          textAlign: 'center',
          letterSpacing: '8px',
          padding: '12px',
          width: '200px',
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#f3f4f6',
        }}
      />
      <button
        onClick={submit}
        disabled={!pin || checking}
        style={{ width: '200px', background: '#6366f1', color: '#fff', fontSize: '17px', padding: '12px' }}
      >
        {checking ? 'Checking...' : 'Unlock'}
      </button>
      {error && <p style={{ color: '#f87171', fontSize: '14px' }}>{error}</p>}
    </div>
  )
}
