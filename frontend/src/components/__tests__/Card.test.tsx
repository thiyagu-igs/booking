import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <div>Card content</div>
      </Card>
    )
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies correct padding classes', () => {
    const { rerender } = render(<Card padding="none">Content</Card>)
    expect(screen.getByText('Content').parentElement).toHaveClass('p-0')

    rerender(<Card padding="sm">Content</Card>)
    expect(screen.getByText('Content').parentElement).toHaveClass('p-4')

    rerender(<Card padding="md">Content</Card>)
    expect(screen.getByText('Content').parentElement).toHaveClass('p-6')

    rerender(<Card padding="lg">Content</Card>)
    expect(screen.getByText('Content').parentElement).toHaveClass('p-8')
  })

  it('applies custom className', () => {
    render(<Card className="custom-class">Content</Card>)
    expect(screen.getByText('Content').parentElement).toHaveClass('custom-class')
  })

  it('has default card styling', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content').parentElement).toHaveClass('card')
  })
})