import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { analyticsService, AnalyticsMetrics, DailyAnalytics, PotentialNoShow } from '../services/analytics';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline';

type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'custom';

export const AnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyAnalytics[]>([]);
  const [potentialNoShows, setPotentialNoShows] = useState<PotentialNoShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
    loadPotentialNoShows();
  }, [selectedPeriod, customStartDate, customEndDate]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      let metricsData: AnalyticsMetrics;
      let dailyAnalyticsData: DailyAnalytics[] = [];

      if (selectedPeriod === 'custom') {
        if (!customStartDate || !customEndDate) {
          return;
        }
        metricsData = await analyticsService.getMetrics(customStartDate, customEndDate);
        dailyAnalyticsData = await analyticsService.getDailyAnalytics(customStartDate, customEndDate);
      } else {
        metricsData = await analyticsService.getQuickAnalytics(selectedPeriod);
        
        // Calculate date range for daily analytics
        const endDate = new Date();
        const startDate = new Date();
        
        switch (selectedPeriod) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
          case 'quarter':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
        }

        dailyAnalyticsData = await analyticsService.getDailyAnalytics(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
      }

      setMetrics(metricsData);
      setDailyData(dailyAnalyticsData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadPotentialNoShows = async () => {
    try {
      const noShows = await analyticsService.getPotentialNoShows();
      setPotentialNoShows(noShows);
    } catch (err) {
      console.error('Error loading potential no-shows:', err);
    }
  };

  const handleMarkNoShow = async (bookingId: string) => {
    try {
      await analyticsService.markNoShow(bookingId);
      await loadPotentialNoShows();
      await loadAnalytics(); // Refresh metrics
    } catch (err) {
      console.error('Error marking no-show:', err);
    }
  };

  const handleExport = async (format: 'metrics' | 'time-to-fill' | 'revenue' | 'daily') => {
    try {
      let startDate: string, endDate: string;

      if (selectedPeriod === 'custom') {
        if (!customStartDate || !customEndDate) return;
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const end = new Date();
        const start = new Date();
        
        switch (selectedPeriod) {
          case 'today':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
          case 'week':
            start.setDate(end.getDate() - 7);
            break;
          case 'month':
            start.setMonth(end.getMonth() - 1);
            break;
          case 'quarter':
            start.setMonth(end.getMonth() - 3);
            break;
        }

        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }

      const blob = await analyticsService.exportData(startDate, endDate, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${format}-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting data:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Advanced insights and performance metrics for your waitlist
          </p>
        </div>
        
        {/* Export buttons */}
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button
            onClick={() => handleExport('metrics')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Time Period Selector */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Period:</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'quarter', 'custom'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 text-sm rounded-md ${
                  selectedPeriod === period
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          )}
        </div>
      </Card>

      {error && (
        <Card>
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </Card>
      )}

      {metrics && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Fill Rate</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatPercentage(metrics.fillRate)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Median Time to Fill</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {metrics.medianTimeToFill}m
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Waitlist Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(metrics.totalRevenue)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No-Show Rate</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatPercentage(metrics.noShowRate)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Booking Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total Slots</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{metrics.totalSlots}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Filled Slots</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{metrics.filledSlots}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Waitlist Bookings</span>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{metrics.waitlistBookings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Direct Bookings</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{metrics.directBookings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Walk-in Bookings</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{metrics.walkInBookings}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Booking Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Completed</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">{metrics.completedBookings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">No Shows</span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">{metrics.noShowBookings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Canceled</span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{metrics.canceledBookings}</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Advanced Analytics Charts */}
      <AdvancedAnalytics 
        selectedPeriod={selectedPeriod}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
      />

      {/* Potential No-Shows */}
      {potentialNoShows.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Potential No-Shows</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {potentialNoShows.length} appointment{potentialNoShows.length !== 1 ? 's' : ''} past due
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Staff
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Appointment Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {potentialNoShows.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {booking.customer_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {booking.customer_phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {booking.service_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {booking.staff_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(booking.slot_start_time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleMarkNoShow(booking.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                      >
                        Mark No-Show
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};