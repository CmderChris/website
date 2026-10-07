import { lazy, Suspense } from 'react'
import './App.css'

const PipWalk = lazy(() => import('pip-walk').then((m) => ({ default: m.PipWalk })))

function App() {
  return (
    <main className="stage">
      <Suspense fallback={null}>
        <PipWalk assetBase="/pip-walk/" />
      </Suspense>
    </main>
  )
}

export default App
