import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MobileStaffApp } from '../../components/MobileStaffApp';

// Mock fetch
global.fetch = jest.fn();

const mockSlots = [
  {
    id: '1',
    start_time: '2024-01-15T09:00:00Z',
    end_time: '2024-01-15T09:30:00Z',
    status: 'open',
    service_name: 'Haircut',
    staff_name: 'John Doe',
    customer_name: null,
    customer_phone: null
  },
  {
    id: '2',
    start_time: '2024-01-15T10:00:00Z',
    end_time: '2024-01-15T11:30:00Z',
    status: 'held',
    service_name: 'Color',
    staff_name: 'Jane Smith',
    customer_name: 'Alice Johnson',
    customer_phone: '+1234567890',
    hold_expires_at: '2024-01-15T10:15:00Z'
  }
];

const mockWaitlist = [
  {
    id: '1',
    customer_name: 'Bob Wilson',
    phone: '+1987654321',
    service_name: 'Haircut',
    staff_name: 'John Doe',
    priority_score: 85,
    created_at: '2024-01-14T15:30:00Z'
  }
];

describe('MobileStaffApp', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    // Mock current date
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T08:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders mobile interface correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSlots)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWaitlist)
      });

    render(<MobileStaffApp />);

    await waitFor(() => {
      expect(screen.getByText('Staff Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Today\'s Slots')).toBeInTheDocument();
      expect(screen.getByText('Waitlist')).toBeInTheDocument();
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });

  it('loads and displays today\'s slots', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSlots)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWaitlist)
      });

    render(<MobileStaffApp />);

    await waitFor(() => {
      expect(screen.getByText('Today\'s Schedule (2)')).toBeInTheDocument();
      expect(screen.getByText('Haircut')).toBeInTheDocument();
      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Check API calls
    expect(fetch).toHaveBeenCalledWith('/api/slots?date=2024-01-15&status=open,held,booked');
    expect(fetch).toHaveBeenCalledWith('/api/waitlist?status=active&limit=20');
  });

  it('displays slot status badges correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSlots)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWaitlist)
      });

    render(<MobileStaffApp />);

    await waitFor(() => {
      expect(screen.getByText('open')).toBeInTheDocument();
      expect(screen.getByText('held')).toBeInTheDocument();
    });
  });

  it('shows appropriate action buttons for different slot statuses', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSlots)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWaitlist)
      });

    render(<MobileStaffApp />);

    await waitFor(() => {
      // Open slot should have "Notify Waitlist" button
      expect(screen.getByText('Notify Waitlist')).toBeInTheDocument();
      
      // Held slot should have "Confirm" and "Cancel" buttons
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('switches between tabs correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSlots)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWaitlist)
      });

    render(<MobileStaffApp />);

    await waitFor(() => {
      expect(screen.getByText('Today\'s Schedule (2)')).toBeInTheDocument();
    });

    // Switch to waitlist tab
    fireEvent.click(screen.getByText('Waitlist'));

    await waitFor(() => {
      expect(screen.getByText('Active Waitlist (1)')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      expect(screen.getByText('Priority: 85')).toBeInTheDocument();
    });

    // Switch to quick actions tab
    fireEvent.click(screen.getByText('Quick Actions'));

    await waitFor(() => {
      expect(screen.getByText('Add Slot')).toBeInTheDocument();
      expect(screen.getByText('Mark Complete')).toBeInTheDocument();
      expect(screen.getByText('Extend Time')).toBeInTheDocument();
      expect(screen.getByText('Mark No-Show')).toBeInTheDocument();
    });
  });

  it('handles slot actions correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSlots)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWaitlist)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]) // Refreshed slots
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]) // Refreshed waitlist
      });

    render(<MobileStaffApp />);

    await waitFor(() => {
      expect(screen.getByText('Notify Waitlist')).toBeInTheDocument();
    });

    // Click notify waitlist button
    fireEvent.click(screen.getByText('Notify Waitlist'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/slots/1/open', {
        method: 'POST'
      });
    });
  });

  it('auto-refreshes data every 30 seconds', async () => {
    (fetch as jest.Mock)
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

    render(<MobileStaffApp />);

    // Initial load
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(4); // 2 more calls for refresh
    });
  });

  it('displays quick stats correctly', async () => {
    const slotsWithVariousStatuses = [
      { ...mockSlots[0], status: 'booked' },
      { ...mockSlots[1], status: 'open' },
      { id: '3', status: 'held', service_name: 'Massage', staff_name: 'Bob', start_time: '2024-01-15T14:00:00Z', end_time: '2024-01-15T15:00:00Z' }
    ];

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(slotsWithVariousStatuses)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWaitlist)
      });

    render(<MobileStaffApp />);

    // Switch to quick actions to see stats
    await waitFor(() => {
      fireEvent.click(screen.getByText('Quick Actions'));
    });

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Booked count
      expect(screen.getByText('1')).toBeInTheDocument(); // Available count  
      expect(screen.getByText('1')).toBeInTheDocument(); // On Hold count
      expect(screen.getByText('1')).toBeInTheDocument(); // Waitlist count
    });
  });

  it('handles empty states correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

    render(<MobileStaffApp />);

    await waitFor(() => {
      expect(screen.getByText('No slots for today')).toBeInTheDocument();
    });

    // Switch to waitlist tab
    fireEvent.click(screen.getByText('Waitlist'));

    await waitFor(() => {
      expect(screen.getByText('No active waitlist entries')).toBeInTheDocument();
    });
  });
});