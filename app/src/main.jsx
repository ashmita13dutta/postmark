import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initClockFromUrl } from './lib/clock'
import './styles/base.css'
import App from './app/App'
// last, so the Apple-style layer overrides every component stylesheet
import './styles/hig.css'
// after that, so the tactile look (raised, sunken, paper) paints over it
import './styles/tactile.css'

initClockFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
