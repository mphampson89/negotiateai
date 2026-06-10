import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { createSession } from './lib/api'

const FIELDS = [
  {
    key: 'counterpartyProfile',
    label: 'Counterparty profile',
    placeholder: 'Who are they, what do they want, what tactics have they used before',
  },
  {
    key: 'documentText',
    label: 'Document text',
    placeholder: 'Paste the contract, lease, term sheet, or relevant clauses here -- as much text as you have',
  },
  {
    key: 'hardLines',
    label: 'My hard lines',
    placeholder: 'What I will not concede under any circumstances',
  },
  {
    key: 'targetPositions',
    label: 'My target positions',
    placeholder: 'What I am aiming for on each key issue',
  },
  {
    key: 'knownRisks',
    label: 'Known risks',
    placeholder: 'What I am worried they will try to do',
  },
  {
    key: 'triggerPatterns',
    label: 'Trigger patterns',
    placeholder: 'Specific tactics to watch for, e.g. false deadline, anchor too high, reassurance instead of concession',
  },
] as const

type FieldKey = typeof FIELDS[number]['key']
type FormState = Record<FieldKey, string>

const STORAGE_KEY = 'negotiateai_deal_context'

function load(): FormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as FormState
  } catch {}
  return { counterpartyProfile: '', documentText: '', hardLines: '', targetPositions: '', knownRisks: '', triggerPatterns: '' }
}

interface Props {
  onStart: (negotiationId: string, context: Record<string, string>) => void
}

export default function DealContext({ onStart }: Props) {
  const [form, setForm] = useState<FormState>(load)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    setStarting(true)
    setError('')
    try {
      const session = await createSession(form)
      onStart(session.id, form)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session')
      setStarting(false)
    }
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  }, [form])

  function handleChange(key: FieldKey) {
    return (e: ChangeEvent<HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
    }
  }

  const canStart = form.counterpartyProfile.trim().length > 0 && form.hardLines.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <header style={{
        padding: '16px 20px',
        borderBottom: '1px solid #374151',
        background: '#111827',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f3f4f6', letterSpacing: '-0.3px' }}>
          NegotiateAI
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>
          Enter deal context before your session
        </p>
      </header>

      <main style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label htmlFor={key}>{label}</label>
            <textarea
              id={key}
              value={form[key]}
              onChange={handleChange(key)}
              placeholder={placeholder}
              rows={4}
            />
          </div>
        ))}
      </main>

      <footer style={{
        padding: '16px 20px',
        borderTop: '1px solid #374151',
        background: '#111827',
        position: 'sticky',
        bottom: 0,
      }}>
        <button
          onClick={handleStart}
          disabled={!canStart || starting}
          style={{
            width: '100%',
            background: canStart ? '#6366f1' : '#374151',
            color: '#fff',
            fontSize: '17px',
          }}
        >
          {starting ? 'Starting...' : 'Start Session'}
        </button>
        {error && (
          <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', marginTop: '8px' }}>
            {error}
          </p>
        )}
        {!canStart && (
          <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
            Fill in Counterparty profile and Hard lines to begin
          </p>
        )}
      </footer>
    </div>
  )
}
