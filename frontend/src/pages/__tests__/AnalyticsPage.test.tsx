import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyticsPage } from '../AnalyticsPage';
import { analyticsService } from '../../services/analytics';

// Mock the analytics service
jest.mock('../../services/analytics');

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  ChartBarIcon: () => <div data-testid="chart-bar-icon" />,
  CurrencyDollarIcon: () => <div data-testid="currency-dollar-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  ExclamationTriangleIcon: () => <div data-testid="exclamation-triangle-icon" />,
  ArrowDownTrayIcon: () => <div data-testid="arrow-down-tray-icon" />,
  CalendarIcon: () => <div data-testid="calendar-icon" />
}));

const mockAnalyticsService = analyticsService as jest.Mocked<typeof analyticsService>;

describe('AnalyticsPage', () => {
  const mockMetrics = {
    fillRate: 75,
    medianTimeToFill: 15,
    totalRevenue: 2500,
    noShowRate: 10,
    totalSlots: 20,
    filledSlots: 15,
    waitlistBookings: 12,
    directBookings: 3,
    walkInBookings: 0,
    completedBookings: 14,
    noShowBookings: 1,
    canceledBookings: 0
  };

  const mockDailyData = [
    {
      date: '2024-01-01',
      total_slots: 5,
      filled_slots: 4,
      waitlist_bookings: 3,
      revenue: 150,
      no_shows: 0
    }
  ];

  const mockPotentialNoShows = [
    {
      id: 'booking-1',
      customer_name: 'John Doe',
      customer_phone: '+1234567890',
      service_name: 'Haircut',
      staff_name: 'Jane Smith',
      slot_start_time: '2024-01-01T10:00:00Z',
      status: 'confirmed'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsService.getQuickAnalytics.mockResolvedValue(mockMetrics);
    mockAnalyticsService.getDailyAnalytics.mockResolvedValue(mockDailyData);
    mockAnalyticsService.getPotentialNoShows.mockResolvedValue(mockPotentialNoShows);
  });

  it('should render analytics page with metrics', async () => {
    render(<AnalyticsPage />);

    // Check if loading spinner appears initially
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    // Check if metrics are displayed
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // Fill Rate
    expect(screen.getByText('15m')).toBeInTheDocument(); // Median Time to Fill
    expect(screen.getByText('$2,500.00')).toBeInTheDocument(); // Revenue
    expect(screen.getByText('10.0%')).toBeInTheDocument(); // No-Show Rate
  });

  it('should display booking breakdown', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Booking Breakdown')).toBeInTheDocument();
    });

    expect(screen.getByText('20')).toBeInTheDocument(); // Total Slots
    expect(screen.getByText('15')).toBeInTheDocument(); // Filled Slots
    expect(screen.getByText('12')).toBeInTheDocument(); // Waitlist Bookings
  });

  it('should display potential no-shows table', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Potential No-Shows')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    expect(screen.getByText('Haircut')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should handle time period selection', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    // Click on "Today" period
    const todayButton = screen.getByText('Today');
    fireEvent.click(todayButton);

    await waitFor(() => {
      expect(mockAnalyticsService.getQuickAnalytics).toHaveBeenCalledWith('today');
    });
  });

  it('should handle custom date range', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    // Click on "Custom" period
    const customButton = screen.getByText('Custom');
    fireEvent.click(customButton);

    // Check if date inputs appear
    const dateInputs = screen.getAllByDisplayValue('');
    expect(dateInputs).toHaveLength(2);

    // Set custom dates
    fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2024-01-31' } });

    await waitFor(() => {
      expect(mockAnalyticsService.getMetrics).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
    });
  });

  it('should handle marking booking as no-show', async () => {
    mockAnalyticsService.markNoShow.mockResolvedValue();
    mockAnalyticsService.getPotentialNoShows
      .mockResolvedValueOnce(mockPotentialNoShows)
      .mockResolvedValueOnce([]); // After marking no-show

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mark No-Show')).toBeInTheDocument();
    });

    const markNoShowButton = screen.getByText('Mark No-Show');
    fireEvent.click(markNoShowButton);

    await waitFor(() => {
      expect(mockAnalyticsService.markNoShow).toHaveBeenCalledWith('booking-1');
    });
  });

  it('should handle export functionality', async () => {
    // Mock URL.createObjectURL and related methods
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
    mockAnalyticsService.exportData.mockResolvedValue(mockBlob);

    // Mock document methods
    const mockAppendChild = jest.fn();
    const mockRemoveChild = jest.fn();
    const mockClick = jest.fn();
    
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick
    };

    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockAnalyticsService.exportData).toHaveBeenCalled();
    });

    expect(mockAppendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor);
  });

  it('should handle error states', async () => {
    mockAnalyticsService.getQuickAnalytics.mockRejectedValue(new Error('API Error'));

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
    });
  });

  it('should display correct period selection styling', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Week')).toBeInTheDocument();
    });

    const weekButton = screen.getByText('Week');
    
    // Week should be selected by default
    expect(weekButton).toHaveClass('bg-blue-100', 'text-blue-800');

    // Click on Month
    const monthButton = screen.getByText('Month');
    fireEvent.click(monthButton);

    await waitFor(() => {
      expect(monthButton).toHaveClass('bg-blue-100', 'text-blue-800');
    });
  });
});