import { useState, useEffect } from 'react'
import Button from '../Button'
import { LoadingSpinner } from '../LoadingSpinner'
import { api } from '../../services/api'

interface BusinessHours {
  [key: string]: {
    isOpen: boolean
    openTime: string
    closeTime: string
  }
}

const daysOfWeek = [
  'monday',
  'tuesday', 
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]

const dayLabels = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday', 
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
}

export default function BusinessHoursSettings() {
  const [hours, setHours] = useState<BusinessHours>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBusinessHours()
  }, [])

  const loadBusinessHours = async () => {
    try {
      const response = await api.get('/settings/business-hours')
      setHours(response.data.data || {})
    } catch (error) {
      console.error('Failed to load business hours:', error)
      // Set default hours if none exist
      const defaultHours: BusinessHours = {}
      daysOfWeek.forEach(day => {
        defaultHours[day] = {
          isOpen: day !== 'sunday',
          openTime: '09:00',
          closeTime: '17:00'
        }
      })
      setHours(defaultHours)
    } finally {
      setLoading(false)
    }
  }

  const updateDay = (day: string, field: string, value: string | boolean) => {
    setHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }))
  }

  const saveBusinessHours = async () => {
    setSaving(true)
    try {
      await api.put('/settings/business-hours', hours)
    } catch (error) {
      console.error('Failed to save business hours:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Business Hours</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Set your operating hours for each day of the week
        </p>
      </div>

      <div className="space-y-4">
        {daysOfWeek.map(day => (
          <div key={day} className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="w-24">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {dayLabels[day as keyof typeof dayLabels]}
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={hours[day]?.isOpen || false}
                onChange={(e) => updateDay(day, 'isOpen', e.target.checked)}
              />
              <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Open</label>
            </div>

            {hours[day]?.isOpen && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Open Time</label>
                  <input
                    type="time"
                    className="input-field w-32"
                    value={hours[day]?.openTime || '09:00'}
                    onChange={(e) => updateDay(day, 'openTime', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Close Time</label>
                  <input
                    type="time"
                    className="input-field w-32"
                    value={hours[day]?.closeTime || '17:00'}
                    onChange={(e) => updateDay(day, 'closeTime', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={saveBusinessHours} loading={saving}>
          Save Business Hours
        </Button>
      </div>
    </div>
  )
}