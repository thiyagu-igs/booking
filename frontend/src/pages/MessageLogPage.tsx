import { useEffect, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/solid'
import { Card } from '../components/Card'
import Button from '../components/Button'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { api } from '../services/api'
import { format } from 'date-fns'

interface MessageLog {
  id: string
  customerName: string
  customerEmail: string
  customerPhone: string
  type: 'notification' | 'confirmation' | 'reminder'
  status: 'sent' | 'delivered' | 'failed' | 'pending'
  subject: string
  sentAt: string
  deliveredAt?: string
  failureReason?: string
  response?: 'confirmed' | 'declined'
  responseAt?: string
}

interface Filters {
  search: string
  type: string
  status: string
  dateFrom: string
  dateTo: string
}

export default function MessageLogPage() {
  const [messages, setMessages] = useState<MessageLog[]>([])
  const [filteredMessages, setFilteredMessages] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [messages, filters])

  const loadMessages = async () => {
    try {
      const response = await api.get('/messages/log')
      setMessages(response.data)
    } catch (error) {
      console.error('Failed to load message log:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = messages

    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(msg =>
        msg.customerName.toLowerCase().includes(search) ||
        msg.customerEmail.toLowerCase().includes(search) ||
        msg.customerPhone.includes(search) ||
        msg.subject.toLowerCase().includes(search)
      )
    }

    if (filters.type) {
      filtered = filtered.filter(msg => msg.type === filters.type)
    }

    if (filters.status) {
      filtered = filtered.filter(msg => msg.status === filters.status)
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(msg => 
        new Date(msg.sentAt) >= new Date(filters.dateFrom)
      )
    }

    if (filters.dateTo) {
      filtered = filtered.filter(msg => 
        new Date(msg.sentAt) <= new Date(filters.dateTo + 'T23:59:59')
      )
    }

    // Sort by sent date (most recent first)
    filtered.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

    setFilteredMessages(filtered)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      case 'sent':
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      delivered: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const styles = {
      notification: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      confirmation: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      reminder: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type as keyof typeof styles]}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    )
  }

  const getResponseBadge = (response?: string) => {
    if (!response) return null

    const styles = {
      confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      declined: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[response as keyof typeof styles]}`}>
        {response.charAt(0).toUpperCase() + response.slice(1)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Message Log</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            View delivery status and customer responses for all sent messages
          </p>
        </div>
        <Button onClick={loadMessages}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                className="input-field pl-10"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
          
          <select
            className="input-field"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="notification">Notification</option>
            <option value="confirmation">Confirmation</option>
            <option value="reminder">Reminder</option>
          </select>

          <select
            className="input-field"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <input
            type="date"
            className="input-field"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            placeholder="From date"
          />

          <input
            type="date"
            className="input-field"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            placeholder="To date"
          />
        </div>
      </Card>

      {/* Message Log Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMessages.map((message) => (
                <tr key={message.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {message.customerName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {message.customerEmail}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {message.customerPhone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {message.subject}
                    </div>
                    {message.failureReason && (
                      <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {message.failureReason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getTypeBadge(message.type)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(message.status)}
                      {getStatusBadge(message.status)}
                    </div>
                    {message.deliveredAt && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Delivered: {format(new Date(message.deliveredAt), 'MMM d, h:mm a')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {message.response ? (
                      <div>
                        {getResponseBadge(message.response)}
                        {message.responseAt && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {format(new Date(message.responseAt), 'MMM d, h:mm a')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No response</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(message.sentAt), 'MMM d, yyyy h:mm a')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredMessages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No messages found</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}