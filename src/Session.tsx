import { useState, useRef, useEffect } from 'react'
import { getDeepgramToken, getCoachingCard, saveTurns, endSession } from './lib/api'

interface Props {
  negotiationId: string
  dealContext: Record<string, string>
  onEnd: () => void
}

interface TranscriptLine {
  text: string
  interim: boolean
}

const COACH_MIN_INTERVAL_MS = 6000
const COACH_TAIL_LINES = 20

export default function Session({ negotiationId, dealContext, onEnd }: Props) {
  const [sessionActive, setSessionActive] = useState(false)
  const [currentCard, setCurrentCard] = useState('')
  const [cardHeld, setCardHeld] = useState(false)
  const [transcriptLog, setTranscriptLog] = useState<TranscriptLine[]>([])
  const [status, setStatus] = useState('Ready')
  const [audioLevel, setAudioLevel] = useState(0)
  const [coachPending, setCoachPending] = useState(false)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const finalLinesRef = useRef<string[]>([])
  const lastCoachAtRef = useRef(0)
  const coachInFlightRef = useRef(false)
  const cardHeldRef = useRef(false)

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcriptLog])

  useEffect(() => {
    return () => stopCapturing()
  }, [])

  async function requestCoaching(force = false) {
    const now = Date.now()
    if (coachInFlightRef.current) return
    if (!force && now - lastCoachAtRef.current < COACH_MIN_INTERVAL_MS) return
    coachInFlightRef.current = true
    lastCoachAtRef.current = now
    if (force) setCoachPending(true)
    try {
      const tail = finalLinesRef.current.slice(-COACH_TAIL_LINES).join('\n')
      const card = await getCoachingCard(dealContext, tail, force)
      if (card) {
        if (force || !cardHeldRef.current) {
          setCurrentCard(card)
          setCardHeld(false)
          cardHeldRef.current = false
        }
        saveTurns([{ negotiation_id: negotiationId, kind: 'coaching_card', content: card }]).catch(() => {})
      }
    } catch {
      // coaching is best-effort; transcription keeps running
    } finally {
      coachInFlightRef.current = false
      setCoachPending(false)
    }
  }

  function handleDeepgramMessage(e: MessageEvent) {
    let msg: any
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    if (msg.type !== 'Results') return
    const text: string = msg.channel?.alternatives?.[0]?.transcript || ''
    if (!text.trim()) return

    if (msg.is_final) {
      finalLinesRef.current.push(text)
      setTranscriptLog(prev => [...prev.filter(l => !l.interim), { text, interim: false }])
      saveTurns([{ negotiation_id: negotiationId, kind: 'transcript', content: text }]).catch(() => {})
      if (msg.speech_final) requestCoaching()
    } else {
      setTranscriptLog(prev => [...prev.filter(l => !l.interim), { text, interim: true }])
    }
  }

  async function connectDeepgram(audioCtx: AudioContext, source: MediaStreamAudioSourceNode) {
    const token = await getDeepgramToken()
    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'en',
      punctuate: 'true',
      interim_results: 'true',
      encoding: 'linear16',
      sample_rate: String(audioCtx.sampleRate),
    })
    // temp JWTs are only accepted via the bearer subprotocol, not a query param
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['bearer', token])
    wsRef.current = ws

    await audioCtx.audioWorklet.addModule('/pcm-worklet.js')
    const worklet = new AudioWorkletNode(audioCtx, 'pcm-worklet')
    source.connect(worklet)
    worklet.port.onmessage = (e) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(e.data)
    }

    ws.onopen = () => setStatus('Transcribing')
    ws.onmessage = handleDeepgramMessage
    ws.onerror = () => setStatus('Deepgram connection error')
    ws.onclose = (e) => {
      if (e.code !== 1000 && streamRef.current) {
        setStatus(`Deepgram closed (${e.code})${e.reason ? `: ${e.reason}` : ''}`)
      }
    }
  }

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

      await connectDeepgram(audioCtx, source)
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'microphone unavailable'}`)
    }
  }

  function stopCapturing() {
    cancelAnimationFrame(animFrameRef.current)
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      // Deepgram flushes any pending finals after CloseStream — drain them
      // (persist only, no UI updates) instead of discarding by closing instantly.
      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data)
          const text: string = msg.channel?.alternatives?.[0]?.transcript || ''
          if (msg.type === 'Results' && msg.is_final && text.trim()) {
            saveTurns([{ negotiation_id: negotiationId, kind: 'transcript', content: text }]).catch(() => {})
          }
          if (msg.type === 'Metadata') ws.close(1000)
        } catch {}
      }
      ws.send(JSON.stringify({ type: 'CloseStream' }))
      setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.close(1000) }, 3000)
    } else {
      ws?.close(1000)
    }
    wsRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    streamRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
    setAudioLevel(0)
    setSessionActive(false)
    setStatus('Ready')
  }

  function handleEnd() {
    stopCapturing()
    endSession(negotiationId).catch(() => {})
    onEnd()
  }

  const hasCard = currentCard.length > 0

  function handleDismiss() {
    setCurrentCard('')
    setCardHeld(false)
    cardHeldRef.current = false
  }

  function handleHold() {
    setCardHeld(true)
    cardHeldRef.current = true
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
          onClick={handleEnd}
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
          <button
            onClick={() => requestCoaching(true)}
            disabled={coachPending}
            style={{ flex: 1, background: coachPending ? '#374151' : '#6366f1', color: '#fff', fontSize: '18px', padding: '16px' }}
          >
            {coachPending ? 'Thinking...' : 'Coach me'}
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
            <p key={i} style={{
              fontSize: '13px',
              color: line.interim ? '#6b7280' : '#d1d5db',
              fontStyle: line.interim ? 'italic' : 'normal',
              marginBottom: '4px',
            }}>{line.text}</p>
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
