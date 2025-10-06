import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Flag to track if we're currently on login page to avoid redirect loops
let isOnLoginPage = false

// Function to update login page status
export const setLoginPageStatus = (status: boolean) => {
  isOnLoginPage = status
}

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login')
      const isCustomerRoute = window.location.pathname.startsWith('/customer/')
      
      if (!isLoginRequest) {
        // Clear stored auth data for non-login 401 errors
        localStorage.removeItem('token')
        delete api.defaults.headers.common['Authorization']
        
        // Only redirect if not on login page and not on customer routes
        if (!isOnLoginPage && !isCustomerRoute && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      // For login requests, just let the error propagate to be handled by the component
    }
    return Promise.reject(error)
  }
)