import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Button from '../Button'
import LoadingSpinner from '../LoadingSpinner'
import { api } from '../../services/api'

interface Service {
  id: string
  name: string
  durationMinutes: number
  price: number
  active: boolean
}

interface ServiceForm {
  name: string
  durationMinutes: number
  price: number
}

export default function ServicesSettings() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState<ServiceForm>({
    name: '',
    durationMinutes: 60,
    price: 0
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const response = await api.get('/services')
      setServices(response.data)
    } catch (error) {
      console.error('Failed to load services:', error)
    } finally {
      setLoading(false)
    }
  }

  const openForm = (service?: Service) => {
    if (service) {
      setEditingService(service)
      setFormData({
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price
      })
    } else {
      setEditingService(null)
      setFormData({
        name: '',
        durationMinutes: 60,
        price: 0
      })
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingService(null)
    setFormData({
      name: '',
      durationMinutes: 60,
      price: 0
    })
  }

  const saveService = async () => {
    setSaving(true)
    try {
      if (editingService) {
        await api.put(`/services/${editingService.id}`, formData)
      } else {
        await api.post('/services', formData)
      }
      closeForm()
      loadServices()
    } catch (error) {
      console.error('Failed to save service:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleServiceStatus = async (service: Service) => {
    try {
      await api.put(`/services/${service.id}`, {
        ...service,
        active: !service.active
      })
      loadServices()
    } catch (error) {
      console.error('Failed to update service status:', error)
    }
  }

  const deleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return
    
    try {
      await api.delete(`/services/${serviceId}`)
      loadServices()
    } catch (error) {
      console.error('Failed to delete service:', error)
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Services</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage the services you offer
          </p>
        </div>
        <Button onClick={() => openForm()}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      {showForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            {editingService ? 'Edit Service' : 'Add New Service'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Service Name
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Haircut"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                className="input-field"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                min="15"
                step="15"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price ($)
              </label>
              <input
                type="number"
                className="input-field"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={saveService} loading={saving}>
              {editingService ? 'Update' : 'Create'} Service
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-center space-x-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {service.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {service.durationMinutes} minutes • ${service.price}
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={service.active}
                  onChange={() => toggleServiceStatus(service)}
                />
                <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openForm(service)}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteService(service.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        
        {services.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No services configured</p>
          </div>
        )}
      </div>
    </div>
  )
}