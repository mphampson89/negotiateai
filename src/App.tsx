import { useState } from 'react'
import './App.css'
import DealContext from './DealContext'
import Session from './Session'

type Screen = 'deal-context' | 'session'

function App() {
  const [screen, setScreen] = useState<Screen>('deal-context')

  return (
    <>
      {screen === 'deal-context' && (
        <DealContext onStart={() => setScreen('session')} />
      )}
      {screen === 'session' && (
        <Session onEnd={() => setScreen('deal-context')} />
      )}
    </>
  )
}

export default App
