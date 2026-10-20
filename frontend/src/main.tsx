import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SimplifiedModeProvider } from './context/SimplifiedModeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SimplifiedModeProvider>
      <App />
    </SimplifiedModeProvider>
  </StrictMode>,
)

