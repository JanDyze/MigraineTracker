import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { AttackStoreProvider } from './lib/store'
import { Layout } from './components/Layout'
import { LogoMark } from './components/Logo'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { LogPage } from './pages/LogPage'
import { DiaryPage } from './pages/DiaryPage'
import { PatternsPage } from './pages/PatternsPage'
import { ChatPage } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'

function Gate() {
  const { session, loading } = useAuth()

  if (loading)
    return (
      <div className="splash">
        <LogoMark size={72} animate="pulse" />
      </div>
    )
  if (!session) return <AuthPage />

  return (
    // keyed by user so switching accounts never shows the previous user's data
    <AttackStoreProvider key={session.user.id}>
      <Routes>
        <Route path="/log" element={<LogPage />} />
        <Route path="/log/:id" element={<LogPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AttackStoreProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}
