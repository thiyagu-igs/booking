import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Button from '../Button'
import LoadingSpinner from '../LoadingSpinner'
import { api } from '../../services/api'

interface Staff {
  id: string
  name: string
  role: string
  active: boolean
}

interface StaffForm {
  name: string
  role: string
}

export default function StaffSettings() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [formData, setFormData] = useState<StaffForm>({
    name: '',
    role: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    try {
      const response = await api.get('/staff')
      setStaff(response.data)
    } catch (error) {
      console.error('Failed to load staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const openForm = (staffMember?: Staff) => {
    if (staffMember) {
      setEditingStaff(staffMember)
      setFormData({
        name: staffMember.name,
        role: staffMember.role
      })
    } else {
      setEditingStaff(null)
      setFormData({
        name: '',
        role: ''
      })
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingStaff(null)
    setFormData({
      name: '',
      role: ''
    })
  }

  const saveStaff = async () => {
    setSaving(true)
    try {
      if (editingStaff) {
        await api.put(`/staff/${editingStaff.id}`, formData)
      } else {
        await api.post('/staff', formData)
      }
      closeForm()
      loadStaff()
    } catch (error) {
      console.error('Failed to save staff:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleStaffStatus = async (staffMember: Staff) => {
    try {
      await api.put(`/staff/${staffMember.id}`, {
        ...staffMember,
        active: !staffMember.active
      })
      loadStaff()
    } catch (error) {
      console.error('Failed to update staff status:', error)
    }
  }

  const deleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return
    
    try {
      await api.delete(`/staff/${staffId}`)
      loadStaff()
    } catch (error) {
      console.error('Failed to delete staff:', error)
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Staff Members</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your team members
          </p>
        </div>
        <Button onClick={() => openForm()}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {showForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John Smith"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role/Title
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g., Senior Stylist"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={saveStaff} loading={saving}>
              {editingStaff ? 'Update' : 'Add'} Staff Member
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {staff.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-center space-x-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {member.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {member.role}
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={member.active}
                  onChange={() => toggleStaffStatus(member)}
                />
                <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openForm(member)}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteStaff(member.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        
        {staff.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No staff members added</p>
          </div>
        )}
      </div>
    </div>
  )
}