import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TenantService } from '../services/tenant'
import { setLoginPageStatus } from '../services/api'
import Button from '../components/Button'
import { Card } from '../components/Card'
import TenantSelector from '../components/TenantSelector'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tenantError, setTenantError] = useState('')
  const { login } = useAuth()

  useEffect(() => {
    // Set login page status to prevent redirect loops
    setLoginPageStatus(true)
    
    // Try to auto-detect tenant from context
    const detectedTenant = TenantService.getTenantFromContext()
    if (detectedTenant) {
      setTenantId(detectedTenant)
    }

    // Cleanup function to reset login page status
    return () => {
      setLoginPageStatus(false)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTenantError('')

    // Validate tenant ID
    if (!tenantId.trim()) {
      setTenantError('Tenant ID is required')
      setLoading(false)
      return
    }

    if (!TenantService.isValidTenantId(tenantId)) {
      setTenantError('Invalid tenant ID format. Please provide a valid UUID.')
      setLoading(false)
      return
    }

    try {
      await login(email, password, tenantId)
      // Login successful - user state will be updated in AuthContext
      console.log('Login successful')
    } catch (err: any) {
      console.error('Login error:', err)
      const message = err.response?.data?.message || err.message || 'Login failed'
      
      // Check for specific error types
      if (message.includes('tenant') || message.includes('Tenant')) {
        setTenantError(message)
      } else if (err.response?.status === 401) {
        setError('Invalid email or password')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Waitlist Management Dashboard
          </p>
        </div>
        <Card>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
                <div className="text-sm text-red-700 dark:text-red-200">{error}</div>
              </div>
            )}
            <TenantSelector
              value={tenantId}
              onChange={setTenantId}
              error={tenantError}
            />

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Sign in
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}