import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { createSession, extractPdfText } from './lib/api'

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

  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function importFiles(files: FileList | File[]) {
    setImporting(true)
    setImportNote('')
    try {
      const texts: string[] = []
      for (const file of Array.from(files)) {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
        if (isPdf) {
          setImportNote(`Extracting text from ${file.name}...`)
          texts.push(`--- ${file.name} ---\n${await extractPdfText(file)}`)
        } else {
          texts.push(`--- ${file.name} ---\n${await file.text()}`)
        }
      }
      setForm(prev => ({
        ...prev,
        documentText: [prev.documentText.trim(), ...texts].filter(Boolean).join('\n\n'),
      }))
      setImportNote(`Added ${files.length} file${files.length > 1 ? 's' : ''}`)
    } catch (e) {
      setImportNote(`Import failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setImporting(false)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files)
  }

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
            {key === 'documentText' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor={key}>{label}</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    style={{ background: '#374151', color: '#f3f4f6', fontSize: '13px', padding: '6px 12px' }}
                  >
                    {importing ? 'Importing...' : 'Upload file'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files?.length) importFiles(e.target.files); e.target.value = '' }}
                  />
                </div>
                <textarea
                  id={key}
                  value={form[key]}
                  onChange={handleChange(key)}
                  placeholder={placeholder + ' -- or drag a PDF / text file here'}
                  rows={4}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={dragOver ? { borderColor: '#6366f1', background: '#1e1b4b' } : undefined}
                />
                {importNote && (
                  <p style={{ fontSize: '12px', color: importNote.startsWith('Import failed') ? '#f87171' : '#9ca3af', marginTop: '4px' }}>
                    {importNote}
                  </p>
                )}
              </>
            ) : (
              <>
                <label htmlFor={key}>{label}</label>
                <textarea
                  id={key}
                  value={form[key]}
                  onChange={handleChange(key)}
                  placeholder={placeholder}
                  rows={4}
                />
              </>
            )}
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
