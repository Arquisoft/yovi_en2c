import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { I18nProvider } from "./i18n/I18nProvider";
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
