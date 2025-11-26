import { useEffect, useState } from 'react'
import { MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Card } from '../components/Card'
import Button from '../components/Button'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { api } from '../services/api'
import { format } from 'date-fns'

interface WaitlistEntry {
  id: string
  customerName: string
  phone: string
  email?: string
  serviceName: string
  staffName?: string
  earliestTime: string
  latestTime: string
  priorityScore: number
  vipStatus: boolean
  status: 'active' | 'notified' | 'confirmed' | 'removed'
  createdAt: string
}

interface Filters {
  search: string
  service: string
  staff: string
  status: string
  vipOnly: boolean
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<WaitlistEntry[]>([])
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([])
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Filters>({
    search: '',
    service: '',
    staff: '',
    status: '',
    vipOnly: false
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [entries, filters])

  const loadData = async () => {
    try {
      const [waitlistRes, servicesRes, staffRes] = await Promise.all([
        api.get('/waitlist'),
        api.get('/services'),
        api.get('/staff')
      ])

      setEntries(waitlistRes.data)
      setServices(servicesRes.data)
      setStaff(staffRes.data)
    } catch (error) {
      console.error('Failed to load waitlist data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = entries

    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(entry =>
        entry.customerName.toLowerCase().includes(search) ||
        entry.phone.includes(search) ||
        entry.email?.toLowerCase().includes(search)
      )
    }

    if (filters.service) {
      filtered = filtered.filter(entry => entry.serviceName === filters.service)
    }

    if (filters.staff) {
      filtered = filtered.filter(entry => entry.staffName === filters.staff)
    }

    if (filters.status) {
      filtered = filtered.filter(entry => entry.status === filters.status)
    }

    if (filters.vipOnly) {
      filtered = filtered.filter(entry => entry.vipStatus)
    }

    // Sort by priority score (descending) then by created date (ascending)
    filtered.sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) {
        return b.priorityScore - a.priorityScore
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    setFilteredEntries(filtered)
  }

  const removeEntry = async (entryId: string) => {
    try {
      await api.delete(`/waitlist/${entryId}`)
      loadData()
    } catch (error) {
      console.error('Failed to remove entry:', error)
    }
  }

  const bulkRemove = async () => {
    try {
      await Promise.all(
        Array.from(selectedEntries).map(id => api.delete(`/waitlist/${id}`))
      )
      setSelectedEntries(new Set())
      loadData()
    } catch (error) {
      console.error('Failed to remove entries:', error)
    }
  }

  const toggleEntrySelection = (entryId: string) => {
    const newSelected = new Set(selectedEntries)
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId)
    } else {
      newSelected.add(entryId)
    }
    setSelectedEntries(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedEntries.size === filteredEntries.length) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(filteredEntries.map(e => e.id)))
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      notified: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      removed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Waitlist Management</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage and monitor your customer waitlist
          </p>
        </div>
        <Button onClick={loadData}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                className="input-field pl-10"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
          
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

          <select
            className="input-field"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="notified">Notified</option>
            <option value="confirmed">Confirmed</option>
            <option value="removed">Removed</option>
          </select>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="vip-only"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              checked={filters.vipOnly}
              onChange={(e) => setFilters({ ...filters, vipOnly: e.target.checked })}
            />
            <label htmlFor="vip-only" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              VIP Only
            </label>
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedEntries.size > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedEntries.size} entries selected
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={bulkRemove}
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Remove Selected
            </Button>
          </div>
        </Card>
      )}

      {/* Waitlist Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    checked={selectedEntries.size === filteredEntries.length && filteredEntries.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time Window
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      checked={selectedEntries.has(entry.id)}
                      onChange={() => toggleEntrySelection(entry.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.customerName}
                          {entry.vipStatus && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                              VIP
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{entry.phone}</div>
                      {entry.email && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{entry.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{entry.serviceName}</div>
                    {entry.staffName && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">with {entry.staffName}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {format(new Date(entry.earliestTime), 'MMM d, h:mm a')}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      to {format(new Date(entry.latestTime), 'MMM d, h:mm a')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.priorityScore}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(entry.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeEntry(entry.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredEntries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No waitlist entries found</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}