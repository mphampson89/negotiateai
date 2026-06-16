import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { listSessions, getSession } from './lib/api'
import type { Negotiation, HistoryTurn } from './lib/api'
import { speakerColor, speakerLabel } from './lib/diarize'

interface Props {
  onBack: () => void
}

function negotiationLabel(n: Negotiation): string {
  const profile = (n.context?.counterpartyProfile || '').trim().replace(/\s+/g, ' ')
  if (profile) return profile.length > 48 ? profile.slice(0, 48) + '…' : profile
  return 'Untitled negotiation'
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function TurnRow({ turn }: { turn: HistoryTurn }) {
  if (turn.kind === 'coaching_card') {
    return (
      <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', borderRadius: '10px', padding: '12px 14px', margin: '10px 0' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a5b4fc', marginBottom: '4px' }}>Coaching</p>
        <p style={{ fontSize: '15px', color: '#e0e7ff', lineHeight: 1.4 }}>{turn.content}</p>
      </div>
    )
  }
  const parsed = turn.speaker != null && turn.speaker !== '' ? Number(turn.speaker) : NaN
  const speaker = Number.isNaN(parsed) ? null : parsed
  return (
    <p style={{ fontSize: '14px', marginBottom: '6px', lineHeight: 1.4, color: speaker != null ? speakerColor(speaker) : '#d1d5db' }}>
      {speaker != null && <strong style={{ marginRight: '6px' }}>{speakerLabel(speaker)}</strong>}
      {turn.content}
    </p>
  )
}

export default function History({ onBack }: Props) {
  const [sessions, setSessions] = useState<Negotiation[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<{ negotiation: Negotiation; turns: HistoryTurn[] } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load history'))
  }, [])

  async function open(id: string) {
    setLoadingDetail(true)
    setError('')
    try {
      setSelected(await getSession(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load session')
    } finally {
      setLoadingDetail(false)
    }
  }

  if (selected) {
    const { negotiation, turns } = selected
    return (
      <div style={page}>
        <header style={headerStyle}>
          <button onClick={() => setSelected(null)} style={backBtn}>← Back</button>
          <span style={titleStyle}>{negotiationLabel(negotiation)}</span>
          <span style={{ minWidth: '64px' }} />
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            {fmtDate(negotiation.started_at)}{negotiation.ended_at ? '' : ' · in progress'}
          </p>
          {turns.length === 0 ? (
            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No transcript or cards were saved for this session.</p>
          ) : (
            turns.map((turn) => <TurnRow key={turn.id} turn={turn} />)
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <header style={headerStyle}>
        <button onClick={onBack} style={backBtn}>← Back</button>
        <span style={{ fontSize: '17px', fontWeight: 700, color: '#f3f4f6' }}>History</span>
        <span style={{ minWidth: '64px' }} />
      </header>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {error && <p style={{ color: '#f87171', fontSize: '14px' }}>{error}</p>}
        {sessions === null && !error && <p style={{ color: '#6b7280' }}>Loading…</p>}
        {sessions && sessions.length === 0 && (
          <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No past negotiations yet.</p>
        )}
        {sessions?.map((s) => (
          <button key={s.id} onClick={() => open(s.id)} disabled={loadingDetail} style={rowBtn}>
            <span style={{ fontSize: '15px', color: '#f3f4f6', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {negotiationLabel(s)}
            </span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              {fmtDate(s.started_at)}{s.ended_at ? '' : ' · in progress'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const page: CSSProperties = {
  display: 'flex', flexDirection: 'column', height: '100dvh', background: '#111827', overflow: 'hidden',
}
const headerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
  padding: '12px 16px', borderBottom: '1px solid #374151', flexShrink: 0,
}
const titleStyle: CSSProperties = {
  flex: 1, textAlign: 'center', fontSize: '15px', fontWeight: 600, color: '#f3f4f6',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const backBtn: CSSProperties = {
  background: '#374151', color: '#f3f4f6', fontSize: '14px', padding: '8px 14px', minHeight: '40px', minWidth: '64px', flexShrink: 0,
}
const rowBtn: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
  width: '100%', textAlign: 'left', background: '#1f2937', border: '1px solid #374151',
  borderRadius: '10px', padding: '14px', marginBottom: '10px',
}
