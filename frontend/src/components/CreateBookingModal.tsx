import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import Button from './Button'
import { LoadingSpinner } from './LoadingSpinner'
import { api } from '../services/api'
import { format } from 'date-fns'
import { BookingSource } from '../pages/BookingsPage'

interface CreateBookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Service {
  id: string
  name: string
  duration: number
  price?: number
}

interface Staff {
  id: string
  name: string
  role?: string
}

interface SlotWithDetails {
  id: string
  start_time: string
  end_time: string
  status: string
  staff_id: string
  service_id: string
  staff_name: string
  service_name: string
}

interface FormData {
  serviceId: string
  staffId: string
  slotId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  bookingSource: BookingSource
}

interface FormErrors {
  serviceId?: string
  slotId?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  bookingSource?: string
}

type Step = 'service' | 'slot' | 'customer'

export default function CreateBookingModal({ isOpen, onClose, onSuccess }: CreateBookingModalProps) {
  const [step, setStep] = useState<Step>('service')
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [availableSlots, setAvailableSlots] = useState<SlotWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  
  const [formData, setFormData] = useState<FormData>({
    serviceId: '',
    staffId: 'any',
    slotId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    bookingSource: 'direct'
  })

  // Load services and staff when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInitialData()
    } else {
      // Reset form when modal closes
      resetForm()
    }
  }, [isOpen])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [servicesRes, staffRes] = await Promise.all([
        api.get('/services'),
        api.get('/staff')
      ])
      setServices(servicesRes.data || [])
      setStaff(staffRes.data || [])
    } catch (error) {
      console.error('Failed to load initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep('service')
    setFormData({
      serviceId: '',
      staffId: 'any',
      slotId: '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      bookingSource: 'direct'
    })
    setAvailableSlots([])
    setErrors({})
  }

  const handleClose = () => {
    if (!submitting) {
      onClose()
    }
  }

  const handleServiceChange = async (serviceId: string) => {
    setFormData({ ...formData, serviceId, slotId: '' })
    setErrors({ ...errors, serviceId: undefined })
    setAvailableSlots([])
  }

  const handleStaffChange = (staffId: string) => {
    setFormData({ ...formData, staffId, slotId: '' })
    setAvailableSlots([])
  }

  const validateServiceStep = () => {
    const newErrors: FormErrors = {}
    
    if (!formData.serviceId) {
      newErrors.serviceId = 'Please select a service'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextFromService = async () => {
    if (!validateServiceStep()) {
      return
    }

    // Load available slots
    try {
      setLoadingSlots(true)
      const params: any = {
        service_id: formData.serviceId,
        status: 'open'
      }
      
      if (formData.staffId !== 'any') {
        params.staff_id = formData.staffId
      }

      const response = await api.get('/slots', { params })
      const slots = response.data.data || []
      
      // Filter to only future slots
      const now = new Date()
      const futureSlots = slots.filter((slot: SlotWithDetails) => 
        new Date(slot.start_time) > now
      )
      
      setAvailableSlots(futureSlots)
      setStep('slot')
    } catch (error) {
      console.error('Failed to load slots:', error)
      setErrors({ ...errors, serviceId: 'Failed to load available slots' })
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSlotSelect = (slotId: string) => {
    setFormData({ ...formData, slotId })
    setErrors({ ...errors, slotId: undefined })
  }

  const validateSlotStep = () => {
    const newErrors: FormErrors = {}
    
    if (!formData.slotId) {
      newErrors.slotId = 'Please select a time slot'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextFromSlot = () => {
    if (validateSlotStep()) {
      setStep('customer')
    }
  }

  const handleBackToService = () => {
    setStep('service')
  }

  const handleBackToSlot = () => {
    setStep('slot')
  }

  const validateCustomerStep = () => {
    const newErrors: FormErrors = {}
    
    // Customer name validation (2-100 chars)
    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required'
    } else if (formData.customerName.trim().length < 2) {
      newErrors.customerName = 'Customer name must be at least 2 characters'
    } else if (formData.customerName.trim().length > 100) {
      newErrors.customerName = 'Customer name must not exceed 100 characters'
    }
    
    // Customer phone validation
    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = 'Customer phone is required'
    } else {
      // Basic phone format validation (allows various formats)
      const phoneRegex = /^[\d\s\-\+\(\)]+$/
      if (!phoneRegex.test(formData.customerPhone)) {
        newErrors.customerPhone = 'Please enter a valid phone number'
      }
    }
    
    // Customer email validation (optional, but must be valid if provided)
    if (formData.customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.customerEmail)) {
        newErrors.customerEmail = 'Please enter a valid email address'
      }
    }
    
    // Booking source validation
    if (!formData.bookingSource) {
      newErrors.bookingSource = 'Please select a booking source'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateCustomerStep()) {
      return
    }

    try {
      setSubmitting(true)
      
      // Prepare booking data
      const bookingData = {
        slot_id: formData.slotId,
        customer_name: formData.customerName.trim(),
        customer_phone: formData.customerPhone.trim(),
        customer_email: formData.customerEmail.trim() || undefined,
        booking_source: formData.bookingSource
      }

      // Submit booking
      await api.post('/bookings', bookingData)

      // Show success toast
      showToast('Booking created successfully!', 'success')

      // Call success callback
      onSuccess()

      // Close modal
      onClose()
    } catch (error: any) {
      console.error('Failed to create booking:', error)
      
      // Handle specific error cases
      if (error.response?.status === 409) {
        // Slot conflict - slot is no longer available
        showToast('This slot is no longer available. Please select a different slot.', 'error')
        setStep('slot')
        // Reload slots
        handleNextFromService()
      } else if (error.response?.status === 400) {
        // Validation error
        const errorMessage = error.response?.data?.error || 'Invalid booking data'
        showToast(errorMessage, 'error')
      } else if (error.response?.status === 404) {
        // Slot not found
        showToast('Slot not found. Please select a different slot.', 'error')
        setStep('slot')
      } else {
        // Generic error
        showToast('Failed to create booking. Please try again.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    // Simple toast implementation
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

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                {/* Header */}
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                      Create New Booking
                    </Dialog.Title>
                    
                    {/* Step Indicator */}
                    <div className="mt-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className={`flex-1 ${step === 'service' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                          <div className="text-xs font-medium">Step 1</div>
                          <div className="text-sm">Service & Staff</div>
                        </div>
                        <div className="flex-shrink-0 px-2">
                          <div className="h-px w-8 bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                        <div className={`flex-1 ${step === 'slot' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                          <div className="text-xs font-medium">Step 2</div>
                          <div className="text-sm">Select Slot</div>
                        </div>
                        <div className="flex-shrink-0 px-2">
                          <div className="h-px w-8 bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                        <div className={`flex-1 ${step === 'customer' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                          <div className="text-xs font-medium">Step 3</div>
                          <div className="text-sm">Customer Info</div>
                        </div>
                      </div>
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <LoadingSpinner size="lg" />
                      </div>
                    ) : (
                      <div className="mt-6">
                        {/* Step 1: Service and Staff Selection */}
                        {step === 'service' && (
                          <div className="space-y-4">
                            {/* Service Selection */}
                            <div>
                              <label htmlFor="service" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Service <span className="text-red-500">*</span>
                              </label>
                              <select
                                id="service"
                                className={`input-field w-full ${errors.serviceId ? 'border-red-500' : ''}`}
                                value={formData.serviceId}
                                onChange={(e) => handleServiceChange(e.target.value)}
                              >
                                <option value="">Select a service</option>
                                {services.map((service) => (
                                  <option key={service.id} value={service.id}>
                                    {service.name} ({service.duration} min)
                                  </option>
                                ))}
                              </select>
                              {errors.serviceId && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.serviceId}</p>
                              )}
                            </div>

                            {/* Staff Selection */}
                            <div>
                              <label htmlFor="staff" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Staff Member
                              </label>
                              <select
                                id="staff"
                                className="input-field w-full"
                                value={formData.staffId}
                                onChange={(e) => handleStaffChange(e.target.value)}
                              >
                                <option value="any">Any Available</option>
                                {staff.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Select a specific staff member or choose "Any Available"
                              </p>
                            </div>

                            {/* Next Button */}
                            <div className="flex justify-end pt-4">
                              <Button
                                onClick={handleNextFromService}
                                loading={loadingSlots}
                                disabled={loadingSlots}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Placeholder for other steps */}
                        {step === 'slot' && (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Select a Time Slot
                              </h4>
                              
                              {availableSlots.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                  <p className="text-gray-500 dark:text-gray-400">
                                    No available slots found for the selected service and staff.
                                  </p>
                                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                                    Try selecting a different staff member or check back later.
                                  </p>
                                </div>
                              ) : (
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                  {availableSlots.map((slot) => (
                                    <label
                                      key={slot.id}
                                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                                        formData.slotId === slot.id
                                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                          : 'border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="slot"
                                        value={slot.id}
                                        checked={formData.slotId === slot.id}
                                        onChange={() => handleSlotSelect(slot.id)}
                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                      />
                                      <div className="ml-3 flex-1">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                              {format(new Date(slot.start_time), 'EEEE, MMMM d, yyyy')}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                              {format(new Date(slot.start_time), 'h:mm a')} - {format(new Date(slot.end_time), 'h:mm a')}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                              {slot.staff_name}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                              
                              {errors.slotId && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.slotId}</p>
                              )}
                            </div>

                            {/* Navigation Buttons */}
                            <div className="flex justify-between pt-4">
                              <Button
                                variant="secondary"
                                onClick={handleBackToService}
                              >
                                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                                Back
                              </Button>
                              <Button
                                onClick={handleNextFromSlot}
                                disabled={availableSlots.length === 0}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {step === 'customer' && (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Customer Information
                              </h4>

                              {/* Customer Name */}
                              <div className="mb-4">
                                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Customer Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  id="customerName"
                                  className={`input-field w-full ${errors.customerName ? 'border-red-500' : ''}`}
                                  value={formData.customerName}
                                  onChange={(e) => {
                                    setFormData({ ...formData, customerName: e.target.value })
                                    setErrors({ ...errors, customerName: undefined })
                                  }}
                                  placeholder="Enter customer name"
                                  maxLength={100}
                                />
                                {errors.customerName && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.customerName}</p>
                                )}
                              </div>

                              {/* Customer Phone */}
                              <div className="mb-4">
                                <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Customer Phone <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="tel"
                                  id="customerPhone"
                                  className={`input-field w-full ${errors.customerPhone ? 'border-red-500' : ''}`}
                                  value={formData.customerPhone}
                                  onChange={(e) => {
                                    setFormData({ ...formData, customerPhone: e.target.value })
                                    setErrors({ ...errors, customerPhone: undefined })
                                  }}
                                  placeholder="Enter customer phone"
                                />
                                {errors.customerPhone && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.customerPhone}</p>
                                )}
                              </div>

                              {/* Customer Email */}
                              <div className="mb-4">
                                <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Customer Email <span className="text-gray-400 text-xs">(optional)</span>
                                </label>
                                <input
                                  type="email"
                                  id="customerEmail"
                                  className={`input-field w-full ${errors.customerEmail ? 'border-red-500' : ''}`}
                                  value={formData.customerEmail}
                                  onChange={(e) => {
                                    setFormData({ ...formData, customerEmail: e.target.value })
                                    setErrors({ ...errors, customerEmail: undefined })
                                  }}
                                  placeholder="Enter customer email"
                                />
                                {errors.customerEmail && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.customerEmail}</p>
                                )}
                              </div>

                              {/* Booking Source */}
                              <div className="mb-4">
                                <label htmlFor="bookingSource" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Booking Source <span className="text-red-500">*</span>
                                </label>
                                <select
                                  id="bookingSource"
                                  className={`input-field w-full ${errors.bookingSource ? 'border-red-500' : ''}`}
                                  value={formData.bookingSource}
                                  onChange={(e) => {
                                    setFormData({ ...formData, bookingSource: e.target.value as BookingSource })
                                    setErrors({ ...errors, bookingSource: undefined })
                                  }}
                                >
                                  <option value="direct">Direct</option>
                                  <option value="walk_in">Walk-in</option>
                                  <option value="waitlist">Waitlist</option>
                                </select>
                                {errors.bookingSource && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bookingSource}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Select how this booking was made
                                </p>
                              </div>
                            </div>

                            {/* Navigation Buttons */}
                            <div className="flex justify-between pt-4">
                              <Button
                                variant="secondary"
                                onClick={handleBackToSlot}
                              >
                                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                                Back
                              </Button>
                              <Button
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={submitting}
                              >
                                Create Booking
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
