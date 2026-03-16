import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="min-h-screen bg-white flex items-center justify-center">
      <h1 className="text-4xl font-display text-navy-900">SLA Bibliography Generator</h1>
    </div>
  </StrictMode>,
)
