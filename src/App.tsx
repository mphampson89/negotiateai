import { useEffect, useRef, useState } from 'react'
import './App.css'
import DealContext from './DealContext'
import Session from './Session'
import Pin from './Pin'
import History from './History'
import { getToken, setToken, clearToken, checkAuth } from './lib/api'
import { MY_APP_ID, pickTrustedParent, validateUnlock } from './lib/bridgeUnlock'

type Screen = 'pin' | 'deal-context' | 'session' | 'history'

function App() {
  const [screen, setScreen] = useState<Screen>('pin')
  const [negotiationId, setNegotiationId] = useState('')
  const [dealContext, setDealContext] = useState<Record<string, string>>({})

  useEffect(() => {
    // Framed under Bridge: ignore the partitioned stored token; the handshake authenticates (§6.3).
    if (window.parent !== window) return
    if (getToken()) {
      checkAuth().then((ok) => ok && setScreen('deal-context'))
    }
  }, [])

  const readySentRef = useRef(false)
  useEffect(() => {
    if (window.parent === window) return
    const parentOrigin = pickTrustedParent()
    if (!parentOrigin) return
    let inFlight = false
    const onMessage = async (ev: MessageEvent) => {
      const verdict = validateUnlock(
        { origin: ev.origin, source: ev.source, data: ev.data },
        { parentOrigin, parentWindow: window.parent },
      )
      if (!verdict.ok || inFlight) return
      inFlight = true
      let ok = false
      try {
        setToken(verdict.credential!)     // overwrite any stored/assistant token with the owner credential
        ok = await checkAuth()
        if (ok) setScreen('deal-context')
        // A rejected credential must not stay on disk: without this, a bad unlock clobbers a
        // working standalone token and locks the app out of its own origin. (Ledger already
        // does this; we were the odd one out.)
        else clearToken()
      } finally {
        inFlight = false
        window.parent.postMessage(
          { type: 'bridge.unlock.ack', v: 1, app: MY_APP_ID, reqId: verdict.reqId, ok },
          parentOrigin,
        )
      }
    }
    window.addEventListener('message', onMessage)
    if (!readySentRef.current) {
      readySentRef.current = true
      window.parent.postMessage({ type: 'bridge.unlock.ready', v: 1, app: MY_APP_ID }, parentOrigin)
    }
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <>
      {screen === 'pin' && (
        <Pin onUnlock={() => setScreen('deal-context')} />
      )}
      {screen === 'deal-context' && (
        <DealContext
          onStart={(id, context) => {
            setNegotiationId(id)
            setDealContext(context)
            setScreen('session')
          }}
          onHistory={() => setScreen('history')}
        />
      )}
      {screen === 'history' && (
        <History onBack={() => setScreen('deal-context')} />
      )}
      {screen === 'session' && (
        <Session
          negotiationId={negotiationId}
          dealContext={dealContext}
          onEnd={() => setScreen('deal-context')}
        />
      )}
    </>
  )
}

export default App
