import { useEffect, useState } from 'react'
import './App.css'
import DealContext from './DealContext'
import Session from './Session'
import Pin from './Pin'
import { getToken, checkAuth } from './lib/api'

type Screen = 'pin' | 'deal-context' | 'session'

function App() {
  const [screen, setScreen] = useState<Screen>('pin')
  const [negotiationId, setNegotiationId] = useState('')
  const [dealContext, setDealContext] = useState<Record<string, string>>({})

  useEffect(() => {
    if (getToken()) {
      checkAuth().then((ok) => ok && setScreen('deal-context'))
    }
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
        />
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
