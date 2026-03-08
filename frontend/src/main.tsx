import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useThemeStore } from './lib/themeStore'

// Initialize theme from storage
const { isDark, setTheme } = useThemeStore.getState();
setTheme(isDark);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
