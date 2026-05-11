import { useState, useRef, useEffect } from 'react'

interface Props {
  onEnd: () => void
}

export default function Session({ onEnd }: Props) {
  const [sessionActive] = useState(false)
  const [currentCard, setCurrentCard] = useState('')
  const [cardHeld, setCardHeld] = useState(false)
  const [transcriptLog] = useState<string[]>([])
  const [status] = useState('Ready')

  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcriptLog])

  const hasCard = currentCard.length > 0

  function handleDismiss() {
    setCurrentCard('')
    setCardHeld(false)
  }

  function handleHold() {
    setCardHeld(true)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: '#111827',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #374151',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6' }}>NegotiateAI</span>
        <button
          onClick={onEnd}
          style={{
            background: '#374151',
            color: '#f3f4f6',
            fontSize: '14px',
            padding: '10px 16px',
            minHeight: '40px',
          }}
        >
          End Session
        </button>
      </header>

      {/* Coaching card area — top 50% */}
      <div style={{
        flex: '0 0 50%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        borderBottom: '1px solid #374151',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1f2937',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
        }}>
          {hasCard ? (
            <p style={{ fontSize: '20px', fontWeight: 600, color: '#f3f4f6', lineHeight: 1.4 }}>
              {currentCard}
            </p>
          ) : (
            <p style={{ fontSize: '20px', color: '#6b7280' }}>Listening...</p>
          )}
        </div>

        {/* Card controls */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button
            onClick={handleHold}
            disabled={!hasCard || cardHeld}
            style={{
              flex: 1,
              background: cardHeld ? '#374151' : '#1d4ed8',
              color: '#fff',
              fontSize: '18px',
              padding: '16px',
            }}
          >
            {cardHeld ? 'Held' : 'Hold'}
          </button>
          <button
            onClick={handleDismiss}
            disabled={!hasCard}
            style={{
              flex: 1,
              background: '#374151',
              color: '#f3f4f6',
              fontSize: '18px',
              padding: '16px',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Transcript feed — bottom 30% */}
      <div
        ref={transcriptRef}
        style={{
          flex: '0 0 30%',
          overflowY: 'auto',
          padding: '12px 16px',
          borderBottom: '1px solid #374151',
        }}
      >
        {transcriptLog.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>
            Transcript will appear here...
          </p>
        ) : (
          transcriptLog.map((line, i) => (
            <p key={i} style={{ fontSize: '13px', color: '#d1d5db', marginBottom: '4px' }}>
              {line}
            </p>
          ))
        )}
      </div>

      {/* Status bar */}
      <div style={{
        padding: '10px 16px',
        background: '#0f172a',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '13px', color: sessionActive ? '#34d399' : '#9ca3af' }}>
          {status}
        </span>
      </div>
    </div>
  )
}
