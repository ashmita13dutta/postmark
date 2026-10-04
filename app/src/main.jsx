import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initClockFromUrl } from './lib/clock'
import './styles/base.css'
import App from './app/App'

initClockFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
