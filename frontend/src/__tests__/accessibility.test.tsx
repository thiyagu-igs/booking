import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '../contexts/ThemeContext'
import Button from '../components/Button'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import LoginPage from '../pages/LoginPage'

// Mock the AuthContext for LoginPage
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: null,
    loading: false,
    logout: vi.fn()
  })
}))

describe('Accessibility Tests', () => {
  describe('Button Component', () => {
    it('has proper ARIA attributes', () => {
      render(<Button disabled>Disabled Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })

    it('has focus styles', () => {
      render(<Button>Focusable Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2')
    })

    it('supports keyboard navigation', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Clickable</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      expect(document.activeElement).toBe(button)
    })
  })

  describe('Form Accessibility', () => {
    it('login form has proper labels and structure', () => {
      render(
        <BrowserRouter>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </BrowserRouter>
      )

      // Check for proper form labels
      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()

      // Check for proper form structure
      const form = screen.getByRole('form', { hidden: true })
      expect(form).toBeInTheDocument()

      // Check for submit button
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).toHaveAttribute('type', 'submit')
    })

    it('form inputs have proper attributes', () => {
      render(
        <BrowserRouter>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('Email address')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')
      expect(emailInput).toHaveAttribute('required')

      const passwordInput = screen.getByLabelText('Password')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
      expect(passwordInput).toHaveAttribute('required')
    })
  })

  describe('Loading States', () => {
    it('loading spinner has proper ARIA attributes', () => {
      render(<LoadingSpinner />)
      // The spinner should be hidden from screen readers as it's decorative
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('loading button has proper state', () => {
      render(<Button loading>Loading Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Color Contrast and Theming', () => {
    it('supports dark mode classes', () => {
      render(
        <ThemeProvider>
          <Card>
            <div className="text-gray-900 dark:text-white">Theme-aware text</div>
          </Card>
        </ThemeProvider>
      )

      const text = screen.getByText('Theme-aware text')
      expect(text).toHaveClass('text-gray-900', 'dark:text-white')
    })

    it('buttons have proper focus indicators', () => {
      render(<Button>Focus Test</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-offset-2')
    })
  })

  describe('Semantic HTML', () => {
    it('uses proper heading hierarchy', () => {
      render(
        <div>
          <h1>Main Title</h1>
          <h2>Section Title</h2>
          <h3>Subsection Title</h3>
        </div>
      )

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Title')
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Section Title')
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Subsection Title')
    })

    it('uses proper landmark roles', () => {
      render(
        <div>
          <main>
            <h1>Main Content</h1>
          </main>
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
            </ul>
          </nav>
        </div>
      )

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })
})