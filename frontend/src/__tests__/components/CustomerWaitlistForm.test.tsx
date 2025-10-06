import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomerWaitlistForm } from '../../components/CustomerWaitlistForm';

// Mock fetch
global.fetch = jest.fn();

const mockServices = [
  { id: '1', name: 'Haircut', duration_minutes: 30, price: 50 },
  { id: '2', name: 'Color', duration_minutes: 90, price: 120 }
];

const mockStaff = [
  { id: '1', name: 'John Doe', role: 'Stylist' },
  { id: '2', name: 'Jane Smith', role: 'Colorist' }
];

describe('CustomerWaitlistForm', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders form fields correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServices)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStaff)
      });

    render(<CustomerWaitlistForm tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/service/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/staff preference/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/earliest time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/latest time/i)).toBeInTheDocument();
    });
  });

  it('loads services and staff on mount', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServices)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStaff)
      });

    render(<CustomerWaitlistForm tenantId="test-tenant" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/public/services?tenant_id=test-tenant');
      expect(fetch).toHaveBeenCalledWith('/api/public/staff?tenant_id=test-tenant');
    });
  });

  it('requires phone verification before submission', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServices)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStaff)
      });

    render(<CustomerWaitlistForm tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByText(/send verification code/i)).toBeInTheDocument();
    });

    // Fill form without phone verification
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'John Doe' }
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+1234567890' }
    });

    const submitButton = screen.getByRole('button', { name: /join waitlist/i });
    expect(submitButton).toBeDisabled();
  });

  it('sends OTP when phone number is provided', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServices)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStaff)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

    render(<CustomerWaitlistForm tenantId="test-tenant" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+1234567890' }
    });

    fireEvent.click(screen.getByText(/send verification code/i));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/public/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+1234567890',
          tenant_id: 'test-tenant'
        })
      });
    });
  });

  it('shows success message after successful submission', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServices)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStaff)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'entry-1', priority_score: 85 })
      });

    render(<CustomerWaitlistForm tenantId="test-tenant" />);

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'John Doe' }
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+1234567890' }
    });

    // Send OTP
    fireEvent.click(screen.getByText(/send verification code/i));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter 6-digit code/i)).toBeInTheDocument();
    });

    // Enter OTP
    fireEvent.change(screen.getByPlaceholderText(/enter 6-digit code/i), {
      target: { value: '123456' }
    });

    // Verify OTP
    fireEvent.click(screen.getByText(/verify/i));

    await waitFor(() => {
      expect(screen.getByText(/phone number verified/i)).toBeInTheDocument();
    });

    // Complete form
    fireEvent.change(screen.getByLabelText(/service/i), {
      target: { value: '1' }
    });
    fireEvent.change(screen.getByLabelText(/earliest time/i), {
      target: { value: '2024-01-15T09:00' }
    });
    fireEvent.change(screen.getByLabelText(/latest time/i), {
      target: { value: '2024-01-15T17:00' }
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /join waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/you're on the waitlist!/i)).toBeInTheDocument();
    });
  });
});