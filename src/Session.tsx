import { useState, useRef, useEffect } from 'react'

interface Props {
  onEnd: () => void
}

export default function Session({ onEnd }: Props) {
  const [sessionActive, setSessionActive] = useState(false)
  const [currentCard, setCurrentCard] = useState('')
  const [cardHeld, setCardHeld] = useState(false)
  const [transcriptLog] = useState<string[]>([])
  const [status, setStatus] = useState('Ready')
  const [audioLevel, setAudioLevel] = useState(0)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcriptLog])

  useEffect(() => {
    return () => stopCapturing()
  }, [])

  async function startCapturing() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      streamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      function tick() {
        analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataArray.length)
        setAudioLevel(Math.min(1, rms * 6))
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()

      setSessionActive(true)
      setStatus('Capturing audio')
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'microphone unavailable'}`)
    }
  }

  function stopCapturing() {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    streamRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
    setAudioLevel(0)
    setSessionActive(false)
    setStatus('Ready')
  }

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
          style={{ background: '#374151', color: '#f3f4f6', fontSize: '14px', padding: '10px 16px', minHeight: '40px' }}
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
            style={{ flex: 1, background: cardHeld ? '#374151' : '#1d4ed8', color: '#fff', fontSize: '18px', padding: '16px' }}
          >
            {cardHeld ? 'Held' : 'Hold'}
          </button>
          <button
            onClick={handleDismiss}
            disabled={!hasCard}
            style={{ flex: 1, background: '#374151', color: '#f3f4f6', fontSize: '18px', padding: '16px' }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Transcript feed — bottom 30% */}
      <div
        ref={transcriptRef}
        style={{ flex: '0 0 30%', overflowY: 'auto', padding: '12px 16px', borderBottom: '1px solid #374151' }}
      >
        {transcriptLog.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>
            Transcript will appear here...
          </p>
        ) : (
          transcriptLog.map((line, i) => (
            <p key={i} style={{ fontSize: '13px', color: '#d1d5db', marginBottom: '4px' }}>{line}</p>
          ))
        )}
      </div>

      {/* Status bar */}
      <div style={{
        padding: '10px 16px',
        background: '#0f172a',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '13px', color: sessionActive ? '#34d399' : '#9ca3af', flexShrink: 0 }}>
          {status}
        </span>

        {/* Level meter */}
        <div style={{
          flex: 1,
          height: '6px',
          background: '#1f2937',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${audioLevel * 100}%`,
            background: audioLevel > 0.7 ? '#f59e0b' : '#34d399',
            borderRadius: '3px',
            transition: 'width 0.05s ease-out',
          }} />
        </div>

        {/* Start / Stop button */}
        <button
          onClick={sessionActive ? stopCapturing : startCapturing}
          style={{
            background: sessionActive ? '#991b1b' : '#065f46',
            color: '#fff',
            fontSize: '13px',
            padding: '8px 14px',
            minHeight: '36px',
            flexShrink: 0,
          }}
        >
          {sessionActive ? 'Stop' : 'Start Capturing'}
        </button>
      </div>
    </div>
  )
}
