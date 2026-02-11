import { useEffect, useState } from 'react'
import { 
  MagnifyingGlassIcon, 
  XMarkIcon, 
  EyeIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  NoSymbolIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { Card } from '../components/Card'
import Button from '../components/Button'
import { LoadingSpinner } from '../components/LoadingSpinner'
import CreateBookingModal from '../components/CreateBookingModal'
import BookingDetailsModal from '../components/BookingDetailsModal'
import { api } from '../services/api'
import { format } from 'date-fns'

// Types based on backend models
export type BookingStatus = 'confirmed' | 'completed' | 'no_show' | 'canceled'
export type BookingSource = 'waitlist' | 'direct' | 'walk_in'

export interface BookingWithDetails {
  id: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  serviceName: string
  staffName: string
  startTime: string
  endTime: string
  status: BookingStatus
  bookingSource: BookingSource
  confirmedAt?: string
  completedAt?: string
  createdAt: string
}

interface BookingFilters {
  search: string
  startDate: string
  endDate: string
  service: string
  staff: string
  status: BookingStatus | ''
  source: BookingSource | ''
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([])
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([])
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filters, setFilters] = useState<BookingFilters>({
    search: '',
    startDate: '',
    endDate: '',
    service: '',
    staff: '',
    status: '',
    source: ''
  })

  useEffect(() => {
    loadBookings()
    loadFiltersData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [bookings, filters])

  const loadBookings = async () => {
    try {
      setLoading(true)
      const response = await api.get('/bookings')
      setBookings(response.data.bookings || [])
    } catch (error) {
      console.error('Failed to load bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFiltersData = async () => {
    try {
      const [servicesRes, staffRes] = await Promise.all([
        api.get('/services'),
        api.get('/staff')
      ])
      setServices(servicesRes.data)
      setStaff(staffRes.data)
    } catch (error) {
      console.error('Failed to load filter data:', error)
    }
  }

  const applyFilters = () => {
    let filtered = bookings

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(booking =>
        booking.customerName.toLowerCase().includes(search) ||
        booking.customerPhone.includes(search) ||
        booking.customerEmail?.toLowerCase().includes(search)
      )
    }

    // Date range filter
    if (filters.startDate) {
      filtered = filtered.filter(booking =>
        new Date(booking.startTime) >= new Date(filters.startDate)
      )
    }

    if (filters.endDate) {
      filtered = filtered.filter(booking =>
        new Date(booking.startTime) <= new Date(filters.endDate)
      )
    }

    // Service filter
    if (filters.service) {
      filtered = filtered.filter(booking => booking.serviceName === filters.service)
    }

    // Staff filter
    if (filters.staff) {
      filtered = filtered.filter(booking => booking.staffName === filters.staff)
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(booking => booking.status === filters.status)
    }

    // Source filter
    if (filters.source) {
      filtered = filtered.filter(booking => booking.bookingSource === filters.source)
    }

    // Sort by date and time (most recent first)
    filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

    setFilteredBookings(filtered)
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      startDate: '',
      endDate: '',
      service: '',
      staff: '',
      status: '',
      source: ''
    })
  }

  const hasActiveFilters = () => {
    return filters.search || filters.startDate || filters.endDate || 
           filters.service || filters.staff || filters.status || filters.source
  }

  const handleMarkCompleted = async (bookingId: string) => {
    if (!confirm('Mark this booking as completed?')) return

    try {
      setActionLoading(bookingId)
      await api.patch(`/bookings/${bookingId}`, { status: 'completed' })
      showToast('Booking marked as completed', 'success')
      await loadBookings()
    } catch (error) {
      console.error('Failed to mark booking as completed:', error)
      showToast('Failed to update booking', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkNoShow = async (bookingId: string) => {
    if (!confirm('Mark this booking as no-show? This will release the slot.')) return

    try {
      setActionLoading(bookingId)
      await api.patch(`/bookings/${bookingId}`, { status: 'no_show' })
      showToast('Booking marked as no-show', 'success')
      await loadBookings()
    } catch (error) {
      console.error('Failed to mark booking as no-show:', error)
      showToast('Failed to update booking', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking? This will release the slot and cannot be undone.')) return

    try {
      setActionLoading(bookingId)
      await api.patch(`/bookings/${bookingId}`, { status: 'canceled' })
      showToast('Booking canceled successfully', 'success')
      await loadBookings()
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      showToast('Failed to cancel booking', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewDetails = (booking: BookingWithDetails) => {
    setSelectedBooking(booking)
    setShowDetailsModal(true)
  }

  const handleBookingUpdated = () => {
    setShowDetailsModal(false)
    loadBookings()
  }

  const handleCreateBooking = () => {
    setShowCreateModal(true)
  }

  const handleBookingCreated = () => {
    setShowCreateModal(false)
    loadBookings()
    showToast('Booking created successfully', 'success')
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    // Simple toast implementation - in production, use a proper toast library
    const toast = document.createElement('div')
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
      type === 'success' 
        ? 'bg-green-500 text-white' 
        : 'bg-red-500 text-white'
    }`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.remove()
    }, 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const getStatusBadge = (status: BookingStatus) => {
    const styles = {
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      no_show: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }

    const labels = {
      confirmed: 'Confirmed',
      completed: 'Completed',
      no_show: 'No Show',
      canceled: 'Canceled'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const getSourceBadge = (source: BookingSource) => {
    const styles = {
      waitlist: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      direct: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      walk_in: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    }

    const labels = {
      waitlist: 'Waitlist',
      direct: 'Direct',
      walk_in: 'Walk-in'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[source]}`}>
        {labels[source]}
      </span>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage and view all customer bookings
          </p>
        </div>
        <Button onClick={handleCreateBooking}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Booking
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, or email..."
                  className="input-field pl-10"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <input
                type="date"
                className="input-field"
                placeholder="Start Date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <input
                type="date"
                className="input-field"
                placeholder="End Date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Service Filter */}
            <select
              className="input-field"
              value={filters.service}
              onChange={(e) => setFilters({ ...filters, service: e.target.value })}
            >
              <option value="">All Services</option>
              {services.map(service => (
                <option key={service.id} value={service.name}>{service.name}</option>
              ))}
            </select>

            {/* Staff Filter */}
            <select
              className="input-field"
              value={filters.staff}
              onChange={(e) => setFilters({ ...filters, staff: e.target.value })}
            >
              <option value="">All Staff</option>
              {staff.map(member => (
                <option key={member.id} value={member.name}>{member.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="input-field"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as BookingStatus | '' })}
            >
              <option value="">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="no_show">No Show</option>
              <option value="canceled">Canceled</option>
            </select>

            {/* Source Filter */}
            <select
              className="input-field"
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value as BookingSource | '' })}
            >
              <option value="">All Sources</option>
              <option value="waitlist">Waitlist</option>
              <option value="direct">Direct</option>
              <option value="walk_in">Walk-in</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters() && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Bookings Table */}
      <Card padding="none">
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
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {booking.customerName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{booking.customerPhone}</div>
                      {booking.customerEmail && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{booking.customerEmail}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{booking.serviceName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{booking.staffName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {format(new Date(booking.startTime), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(booking.status)}
                  </td>
                  <td className="px-6 py-4">
                    {getSourceBadge(booking.bookingSource)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* View Details */}
                      <button
                        onClick={() => handleViewDetails(booking)}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        title="View Details"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>

                      {/* Mark Completed - only for confirmed bookings */}
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleMarkCompleted(booking.id)}
                          disabled={actionLoading === booking.id}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                          title="Mark as Completed"
                        >
                          <CheckCircleIcon className="h-5 w-5" />
                        </button>
                      )}

                      {/* Mark No-Show - only for confirmed bookings */}
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleMarkNoShow(booking.id)}
                          disabled={actionLoading === booking.id}
                          className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 disabled:opacity-50"
                          title="Mark as No-Show"
                        >
                          <NoSymbolIcon className="h-5 w-5" />
                        </button>
                      )}

                      {/* Cancel - only for confirmed bookings */}
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={actionLoading === booking.id}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                          title="Cancel Booking"
                        >
                          <XCircleIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredBookings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {hasActiveFilters() ? 'No bookings match your filters' : 'No bookings found'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        onUpdate={handleBookingUpdated}
      />
      
      {/* Create Booking Modal */}
      <CreateBookingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleBookingCreated}
      />
    </div>
  )
}
