import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import WaitlistPage from './pages/WaitlistPage'
import SettingsPage from './pages/SettingsPage'
import MessageLogPage from './pages/MessageLogPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CustomerWaitlistPage } from './pages/CustomerWaitlistPage'
import { MobileStaffApp } from './components/MobileStaffApp'
import LoadingSpinner from './components/LoadingSpinner'
import { useEffect } from 'react'
import { pushNotificationService } from './services/pushNotifications'

function App() {
  const { user, loading } = useAuth()

  useEffect(() => {
    // Initialize PWA features
    const initializePWA = async () => {
      // Initialize push notifications
      await pushNotificationService.initialize()
      
      // Request notification permission for authenticated users
      if (user) {
        const permission = await pushNotificationService.requestPermission()
        if (permission === 'granted') {
          await pushNotificationService.subscribeToPush()
        }
      }
    }

    initializePWA()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Public routes (no authentication required)
  if (window.location.pathname.startsWith('/customer/')) {
    return (
      <Routes>
        <Route path="/customer/waitlist" element={<CustomerWaitlistPage />} />
        <Route path="*" element={<Navigate to="/customer/waitlist" replace />} />
      </Routes>
    )
  }

  // Mobile staff app route
  if (window.location.pathname === '/mobile' && user) {
    return <MobileStaffApp />
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/messages" element={<MessageLogPage />} />
        <Route path="/mobile" element={<MobileStaffApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App