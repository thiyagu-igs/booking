import { useEffect, useState } from 'react'
import { 
  ClockIcon, 
  UserGroupIcon, 
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { Card } from '../components/Card'
import { LoadingSpinner } from '../components/LoadingSpinner'
import Button from '../components/Button'
import { api } from '../services/api'
import { format } from 'date-fns'

interface DashboardStats {
  openSlots: number
  pendingHolds: number
  todayBookings: number
  activeWaitlist: number
}

interface Slot {
  id: string
  staffName: string
  serviceName: string
  startTime: string
  endTime: string
  status: 'open' | 'held' | 'booked'
  holdExpiresAt?: string
  customerName?: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [openSlots, setOpenSlots] = useState<Slot[]>([])
  const [pendingHolds, setPendingHolds] = useState<Slot[]>([])
  const [todayBookings, setTodayBookings] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [statsRes, slotsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/slots', { params: { date: format(new Date(), 'yyyy-MM-dd') } })
      ])

      setStats(statsRes.data)
      
      const slots = slotsRes.data
      setOpenSlots(slots.filter((s: Slot) => s.status === 'open'))
      setPendingHolds(slots.filter((s: Slot) => s.status === 'held'))
      setTodayBookings(slots.filter((s: Slot) => s.status === 'booked'))
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const markSlotOpen = async (slotId: string) => {
    try {
      await api.post(`/slots/${slotId}/open`)
      loadDashboardData() // Refresh data
    } catch (error) {
      console.error('Failed to mark slot as open:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      name: 'Open Slots',
      value: stats?.openSlots || 0,
      icon: ClockIcon,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20'
    },
    {
      name: 'Pending Holds',
      value: stats?.pendingHolds || 0,
      icon: ExclamationTriangleIcon,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20'
    },
    {
      name: "Today's Bookings",
      value: stats?.todayBookings || 0,
      icon: CalendarDaysIcon,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    },
    {
      name: 'Active Waitlist',
      value: stats?.activeWaitlist || 0,
      icon: UserGroupIcon,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20'
    }
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Overview of your waitlist and booking activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="animate-slide-up">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} aria-hidden="true" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Open Slots */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Open Slots</h2>
          <Button size="sm" onClick={loadDashboardData}>
            Refresh
          </Button>
        </div>
        {openSlots.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No open slots available
          </p>
        ) : (
          <div className="space-y-4">
            {openSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {slot.serviceName} with {slot.staffName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(slot.startTime), 'h:mm a')} - {format(new Date(slot.endTime), 'h:mm a')}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => markSlotOpen(slot.id)}
                >
                  Notify Waitlist
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending Holds */}
      {pendingHolds.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Pending Holds</h2>
          <div className="space-y-4">
            {pendingHolds.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 border border-yellow-200 dark:border-yellow-700 rounded-lg bg-yellow-50 dark:bg-yellow-900/10"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {slot.serviceName} with {slot.staffName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(slot.startTime), 'h:mm a')} - {format(new Date(slot.endTime), 'h:mm a')}
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Hold expires: {slot.holdExpiresAt && format(new Date(slot.holdExpiresAt), 'h:mm a')}
                  </p>
                </div>
                <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                  <ClockIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm font-medium">Waiting for response</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Today's Bookings */}
      {todayBookings.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Today's Bookings</h2>
          <div className="space-y-4">
            {todayBookings.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 border border-green-200 dark:border-green-700 rounded-lg bg-green-50 dark:bg-green-900/10"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {slot.serviceName} with {slot.staffName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(slot.startTime), 'h:mm a')} - {format(new Date(slot.endTime), 'h:mm a')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Customer: {slot.customerName}
                  </p>
                </div>
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm font-medium">Confirmed</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}