import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Card } from './Card';
import { LoadingSpinner } from './LoadingSpinner';
import { analyticsService, DailyAnalytics, AnalyticsMetrics } from '../services/analytics';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface AdvancedAnalyticsProps {
  selectedPeriod: string;
  customStartDate?: string;
  customEndDate?: string;
}

export const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({
  selectedPeriod,
  customStartDate,
  customEndDate
}) => {
  const [dailyData, setDailyData] = useState<DailyAnalytics[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod, customStartDate, customEndDate]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      let startDate: string, endDate: string;

      if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
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
          default:
            start.setDate(end.getDate() - 7);
        }

        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }

      const [dailyAnalytics, metricsData] = await Promise.all([
        analyticsService.getDailyAnalytics(startDate, endDate),
        analyticsService.getMetrics(startDate, endDate)
      ]);

      setDailyData(dailyAnalytics);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Chart configurations
  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Daily Booking Trends',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Revenue by Source',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return '$' + value;
          }
        }
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: 'Booking Status Distribution',
      },
    },
  };

  // Prepare chart data
  const lineChartData = {
    labels: dailyData.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Total Bookings',
        data: dailyData.map(d => d.total_bookings),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      },
      {
        label: 'Waitlist Bookings',
        data: dailyData.map(d => d.waitlist_bookings),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1,
      },
      {
        label: 'No Shows',
        data: dailyData.map(d => d.no_shows),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const barChartData = {
    labels: ['Waitlist', 'Direct', 'Walk-in'],
    datasets: [
      {
        label: 'Revenue ($)',
        data: metrics ? [
          metrics.waitlistRevenue || 0,
          metrics.directRevenue || 0,
          metrics.walkInRevenue || 0
        ] : [0, 0, 0],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const doughnutData = {
    labels: ['Completed', 'No Shows', 'Canceled'],
    datasets: [
      {
        data: metrics ? [
          metrics.completedBookings,
          metrics.noShowBookings,
          metrics.canceledBookings
        ] : [0, 0, 0],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderColor: [
          'rgb(16, 185, 129)',
          'rgb(239, 68, 68)',
          'rgb(156, 163, 175)',
        ],
        borderWidth: 2,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-red-600 dark:text-red-400 text-center">{error}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Conversion Rate
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {((metrics.waitlistBookings / Math.max(metrics.totalSlots, 1)) * 100).toFixed(1)}%
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
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Avg. Response Time
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {metrics.avgResponseTime || 0}m
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
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Revenue per Slot
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  ${(metrics.totalRevenue / Math.max(metrics.filledSlots, 1)).toFixed(0)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Active Waitlist
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {metrics.activeWaitlistEntries || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Daily Trends */}
        <Card>
          <div className="h-80">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </Card>

        {/* Bar Chart - Revenue by Source */}
        <Card>
          <div className="h-80">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </Card>

        {/* Doughnut Chart - Booking Status */}
        <Card>
          <div className="h-80 flex items-center justify-center">
            <div className="w-64 h-64">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </div>
        </Card>

        {/* Performance Metrics Table */}
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Performance Insights
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Peak Booking Day
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {dailyData.length > 0 
                  ? new Date(dailyData.reduce((max, day) => 
                      day.total_bookings > max.total_bookings ? day : max
                    ).date).toLocaleDateString('en-US', { weekday: 'long' })
                  : 'N/A'
                }
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Best Fill Rate Day
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {dailyData.length > 0 
                  ? new Date(dailyData.reduce((max, day) => 
                      (day.waitlist_bookings / Math.max(day.total_slots, 1)) > 
                      (max.waitlist_bookings / Math.max(max.total_slots, 1)) ? day : max
                    ).date).toLocaleDateString('en-US', { weekday: 'long' })
                  : 'N/A'
                }
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Notifications Sent
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {dailyData.reduce((sum, day) => sum + (day.notifications_sent || 0), 0)}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Customer Satisfaction
              </span>
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                {metrics ? (100 - metrics.noShowRate).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Daily Breakdown */}
      {dailyData.length > 0 && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Daily Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Slots
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Waitlist Bookings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fill Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    No Shows
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {dailyData.map((day) => (
                  <tr key={day.date}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(day.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {day.total_slots}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 font-medium">
                      {day.waitlist_bookings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {((day.waitlist_bookings / Math.max(day.total_slots, 1)) * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-medium">
                      ${day.revenue?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                      {day.no_shows}
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