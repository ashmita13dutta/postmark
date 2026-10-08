import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initClockFromUrl } from './lib/clock'
import './styles/base.css'
import App from './app/App'
// last, so the Apple-style layer overrides every component stylesheet
import './styles/hig.css'

initClockFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
