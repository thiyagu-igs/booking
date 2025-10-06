import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import { TenantService } from '../services/tenant'

interface User {
  id: string
  email: string
  tenantId: string
  tenantName: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, tenantId: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // Verify token and get user info
      api.get('/auth/me')
        .then(response => {
          setUser(response.data.data)
        })
        .catch(() => {
          localStorage.removeItem('token')
          delete api.defaults.headers.common['Authorization']
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string, tenantId: string) => {
    // Validate tenant ID format
    if (!TenantService.isValidTenantId(tenantId)) {
      throw new Error('Invalid tenant ID format. Please provide a valid UUID.')
    }

    try {
      const response = await api.post('/auth/login', { email, password, tenantId })
      
      // Check if response has the expected structure
      if (!response.data || !response.data.data) {
        throw new Error('Invalid response format from server')
      }
      
      const { token, user: userData } = response.data.data
      
      if (!token || !userData) {
        throw new Error('Missing authentication data in response')
      }
      
      // Store tenant selection for future use
      TenantService.setSelectedTenant(tenantId)
      
      localStorage.setItem('token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(userData)
      
      console.log('Login successful, user set:', userData)
    } catch (error: any) {
      console.error('Login failed in AuthContext:', error)
      // Don't store tenant on failed login
      // Re-throw the error to be handled by the component
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    TenantService.clearSelectedTenant()
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}