import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { LoadingSpinner } from './LoadingSpinner';
import {
  ClockIcon,
  UserIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  CalendarIcon,
  BellIcon
} from '@heroicons/react/24/outline';

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  status: 'open' | 'held' | 'booked' | 'canceled';
  service_name: string;
  staff_name: string;
  customer_name?: string;
  customer_phone?: string;
  hold_expires_at?: string;
}

interface WaitlistEntry {
  id: string;
  customer_name: string;
  phone: string;
  service_name: string;
  staff_name?: string;
  priority_score: number;
  created_at: string;
}

export const MobileStaffApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'slots' | 'waitlist' | 'quick-actions'>('slots');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const today = new Date().toISOString().split('T')[0];
      const [slotsRes, waitlistRes] = await Promise.all([
        fetch(`/api/slots?date=${today}&status=open,held,booked`),
        fetch('/api/waitlist?status=active&limit=20')
      ]);

      if (slotsRes.ok && waitlistRes.ok) {
        const [slotsData, waitlistData] = await Promise.all([
          slotsRes.json(),
          waitlistRes.json()
        ]);
        setSlots(slotsData);
        setWaitlist(waitlistData);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markSlotOpen = async (slotId: string) => {
    try {
      const response = await fetch(`/api/slots/${slotId}/open`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadData(true);
        // Show success notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Slot opened successfully', {
            body: 'Waitlist customers will be notified automatically',
            icon: '/icons/icon-192x192.png'
          });
        }
      }
    } catch (err) {
      console.error('Error opening slot:', err);
    }
  };

  const confirmBooking = async (slotId: string) => {
    try {
      const response = await fetch(`/api/slots/${slotId}/confirm`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadData(true);
      }
    } catch (err) {
      console.error('Error confirming booking:', err);
    }
  };

  const cancelSlot = async (slotId: string) => {
    try {
      const response = await fetch(`/api/slots/${slotId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadData(true);
      }
    } catch (err) {
      console.error('Error canceling slot:', err);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'held': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'booked': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'canceled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const TabButton: React.FC<{ tab: string; label: string; icon: React.ReactNode }> = ({ tab, label, icon }) => (
    <button
      onClick={() => setActiveTab(tab as any)}
      className={`flex-1 flex flex-col items-center py-2 px-1 text-xs font-medium rounded-lg ${
        activeTab === tab
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </button>
  );

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Staff Dashboard</h1>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-blue-100 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-50 dark:bg-gray-800 p-2 space-x-1">
        <TabButton
          tab="slots"
          label="Today's Slots"
          icon={<CalendarIcon className="h-5 w-5" />}
        />
        <TabButton
          tab="waitlist"
          label="Waitlist"
          icon={<UserIcon className="h-5 w-5" />}
        />
        <TabButton
          tab="quick-actions"
          label="Quick Actions"
          icon={<PlusIcon className="h-5 w-5" />}
        />
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'slots' && (
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Today's Schedule ({slots.length})
            </h2>
            
            {slots.length === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No slots for today</p>
                </div>
              </Card>
            ) : (
              slots.map(slot => (
                <Card key={slot.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <ClockIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(slot.status)}`}>
                          {slot.status}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                        {slot.service_name}
                      </p>
                      
                      {slot.customer_name && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                          <UserIcon className="h-4 w-4" />
                          <span>{slot.customer_name}</span>
                          {slot.customer_phone && (
                            <>
                              <PhoneIcon className="h-4 w-4" />
                              <span>{slot.customer_phone}</span>
                            </>
                          )}
                        </div>
                      )}
                      
                      {slot.hold_expires_at && slot.status === 'held' && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                          Hold expires: {formatTime(slot.hold_expires_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2 mt-3">
                    {slot.status === 'open' && (
                      <button
                        onClick={() => markSlotOpen(slot.id)}
                        className="flex-1 bg-blue-600 text-white text-sm py-2 px-3 rounded-md hover:bg-blue-700 flex items-center justify-center"
                      >
                        <BellIcon className="h-4 w-4 mr-1" />
                        Notify Waitlist
                      </button>
                    )}
                    
                    {slot.status === 'held' && (
                      <>
                        <button
                          onClick={() => confirmBooking(slot.id)}
                          className="flex-1 bg-green-600 text-white text-sm py-2 px-3 rounded-md hover:bg-green-700 flex items-center justify-center"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Confirm
                        </button>
                        <button
                          onClick={() => cancelSlot(slot.id)}
                          className="flex-1 bg-red-600 text-white text-sm py-2 px-3 rounded-md hover:bg-red-700 flex items-center justify-center"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Cancel
                        </button>
                      </>
                    )}
                    
                    {slot.status === 'booked' && (
                      <button
                        onClick={() => cancelSlot(slot.id)}
                        className="flex-1 bg-red-600 text-white text-sm py-2 px-3 rounded-md hover:bg-red-700 flex items-center justify-center"
                      >
                        <XCircleIcon className="h-4 w-4 mr-1" />
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'waitlist' && (
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Active Waitlist ({waitlist.length})
            </h2>
            
            {waitlist.length === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No active waitlist entries</p>
                </div>
              </Card>
            ) : (
              waitlist.map(entry => (
                <Card key={entry.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.customer_name}
                        </span>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                          Priority: {entry.priority_score}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                        <PhoneIcon className="h-4 w-4" />
                        <span>{entry.phone}</span>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                        Service: {entry.service_name}
                      </p>
                      
                      {entry.staff_name && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Preferred Staff: {entry.staff_name}
                        </p>
                      )}
                      
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Joined: {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'quick-actions' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Quick Actions
            </h2>
            
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-blue-600 text-white p-4 rounded-lg text-center hover:bg-blue-700">
                <PlusIcon className="h-6 w-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Add Slot</span>
              </button>
              
              <button className="bg-green-600 text-white p-4 rounded-lg text-center hover:bg-green-700">
                <CheckCircleIcon className="h-6 w-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Mark Complete</span>
              </button>
              
              <button className="bg-yellow-600 text-white p-4 rounded-lg text-center hover:bg-yellow-700">
                <ClockIcon className="h-6 w-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Extend Time</span>
              </button>
              
              <button className="bg-red-600 text-white p-4 rounded-lg text-center hover:bg-red-700">
                <XCircleIcon className="h-6 w-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Mark No-Show</span>
              </button>
            </div>
            
            {/* Quick Stats */}
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Today's Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {slots.filter(s => s.status === 'booked').length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Booked</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {slots.filter(s => s.status === 'open').length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {slots.filter(s => s.status === 'held').length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">On Hold</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {waitlist.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Waitlist</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};