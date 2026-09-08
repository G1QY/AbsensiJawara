import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './lib/AuthContext'
import NotificationsProvider from './lib/NotificationsContext'
import PreferencesProvider from './lib/PreferencesContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider>
    <AuthProvider>
      <NotificationsProvider><App /></NotificationsProvider>
    </AuthProvider>
    </PreferencesProvider>
  </React.StrictMode>,
)
