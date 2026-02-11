import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  XMarkIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  NoSymbolIcon,
  UserIcon,
  BriefcaseIcon,
  CalendarIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import Button from './Button'
import { api } from '../services/api'
import { format } from 'date-fns'
import { BookingWithDetails, BookingStatus } from '../pages/BookingsPage'

interface BookingDetailsModalProps {
  booking: BookingWithDetails | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (booking: BookingWithDetails) => void
}

export default function BookingDetailsModal({ 
  booking, 
  isOpen, 
  onClose, 
  onUpdate 
}: BookingDetailsModalProps) {
  const [updating, setUpdating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false)

  if (!booking) return null

  const handleClose = () => {
    if (!updating) {
      setShowCancelConfirm(false)
      setShowNoShowConfirm(false)
      onClose()
    }
  }

  const handleStatusUpdate = async (newStatus: BookingStatus) => {
    try {
      setUpdating(true)
      const response = await api.patch(`/bookings/${booking.id}`, { status: newStatus })
      
      // Show success toast
      showToast(`Booking ${newStatus === 'completed' ? 'completed' : newStatus === 'no_show' ? 'marked as no-show' : 'canceled'} successfully`, 'success')
      
      // Call onUpdate callback with updated booking
      onUpdate(response.data.booking)
      
      // Close modal
      handleClose()
    } catch (error: any) {
      console.error('Failed to update booking status:', error)
      const errorMessage = error.response?.data?.error || 'Failed to update booking status'
      showToast(errorMessage, 'error')
    } finally {
      setUpdating(false)
      setShowCancelConfirm(false)
      setShowNoShowConfirm(false)
    }
  }

  const handleMarkCompleted = () => {
    handleStatusUpdate('completed')
  }

  const handleMarkNoShow = () => {
    if (!showNoShowConfirm) {
      setShowNoShowConfirm(true)
      return
    }
    handleStatusUpdate('no_show')
  }

  const handleCancelBooking = () => {
    if (!showCancelConfirm) {
      setShowCancelConfirm(true)
      return
    }
    handleStatusUpdate('canceled')
  }

  const showToast = (message: string, type: 'success' | 'error') => {
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
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      waitlist: 'Waitlist',
      direct: 'Direct',
      walk_in: 'Walk-in'
    }
    return labels[source] || source
  }

  const canUpdateStatus = booking.status === 'confirmed'

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
                    disabled={updating}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mb-4">
                      Booking Details
                    </Dialog.Title>

                    {/* Booking Information Sections */}
                    <div className="space-y-6">
                      {/* Customer Information Section */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center mb-3">
                          <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Customer Information</h4>
                        </div>
                        <div className="ml-7 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{booking.customerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Phone:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{booking.customerPhone}</span>
                          </div>
                          {booking.customerEmail && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Email:</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{booking.customerEmail}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Service Details Section */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center mb-3">
                          <BriefcaseIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Service Details</h4>
                        </div>
                        <div className="ml-7 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Service:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{booking.serviceName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Staff:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{booking.staffName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Appointment Details Section */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex items-center mb-3">
                          <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Appointment Details</h4>
                        </div>
                        <div className="ml-7 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Date:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {format(new Date(booking.startTime), 'EEEE, MMMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Time:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                            {getStatusBadge(booking.status)}
                          </div>
                        </div>
                      </div>

                      {/* Booking Metadata Section */}
                      <div className="pb-4">
                        <div className="flex items-center mb-3">
                          <TagIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Booking Metadata</h4>
                        </div>
                        <div className="ml-7 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Source:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{getSourceLabel(booking.bookingSource)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Created:</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {format(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          {booking.confirmedAt && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Confirmed:</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {format(new Date(booking.confirmedAt), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                          )}
                          {booking.completedAt && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Completed:</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {format(new Date(booking.completedAt), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Confirmation Dialogs */}
                    {showCancelConfirm && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-400">
                          Are you sure you want to cancel this booking? This will release the slot and cannot be undone.
                        </p>
                      </div>
                    )}

                    {showNoShowConfirm && (
                      <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <p className="text-sm text-orange-800 dark:text-orange-400">
                          Are you sure you want to mark this booking as no-show? This will release the slot.
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {canUpdateStatus && (
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                          onClick={handleMarkCompleted}
                          disabled={updating}
                          loading={updating}
                          variant="primary"
                          size="sm"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Mark as Completed
                        </Button>

                        <Button
                          onClick={handleMarkNoShow}
                          disabled={updating}
                          loading={updating}
                          variant="secondary"
                          size="sm"
                        >
                          <NoSymbolIcon className="h-4 w-4 mr-1" />
                          {showNoShowConfirm ? 'Confirm No-Show' : 'Mark as No-Show'}
                        </Button>

                        <Button
                          onClick={handleCancelBooking}
                          disabled={updating}
                          loading={updating}
                          variant="secondary"
                          size="sm"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          {showCancelConfirm ? 'Confirm Cancel' : 'Cancel Booking'}
                        </Button>

                        {(showCancelConfirm || showNoShowConfirm) && (
                          <Button
                            onClick={() => {
                              setShowCancelConfirm(false)
                              setShowNoShowConfirm(false)
                            }}
                            disabled={updating}
                            variant="secondary"
                            size="sm"
                          >
                            Cancel Action
                          </Button>
                        )}
                      </div>
                    )}

                    {!canUpdateStatus && (
                      <div className="mt-6">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          This booking cannot be modified because it is {booking.status}.
                        </p>
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
