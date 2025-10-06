import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { LoadingSpinner } from './LoadingSpinner';
import { PhoneIcon, EnvelopeIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface CustomerWaitlistFormProps {
  tenantId: string;
  onSuccess?: () => void;
  embedded?: boolean;
}

export const CustomerWaitlistForm: React.FC<CustomerWaitlistFormProps> = ({
  tenantId,
  onSuccess,
  embedded = false
}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    email: '',
    service_id: '',
    staff_id: '',
    earliest_time: '',
    latest_time: '',
    otp_code: ''
  });

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesRes, staffRes] = await Promise.all([
        fetch(`/api/public/services?tenant_id=${tenantId}`),
        fetch(`/api/public/staff?tenant_id=${tenantId}`)
      ]);

      if (servicesRes.ok && staffRes.ok) {
        const [servicesData, staffData] = await Promise.all([
          servicesRes.json(),
          staffRes.json()
        ]);
        setServices(servicesData);
        setStaff(staffData);
      } else {
        setError('Failed to load services and staff');
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const sendOTP = async () => {
    if (!formData.phone) {
      setError('Please enter your phone number');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/public/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          tenant_id: tenantId
        })
      });

      if (response.ok) {
        setOtpSent(true);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOTP = async () => {
    if (!formData.otp_code) {
      setError('Please enter the OTP code');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/public/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          otp_code: formData.otp_code,
          tenant_id: tenantId
        })
      });

      if (response.ok) {
        setOtpVerified(true);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Invalid OTP code');
      }
    } catch (err) {
      setError('Failed to verify OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpVerified) {
      setError('Please verify your phone number first');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/public/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tenant_id: tenantId
        })
      });

      if (response.ok) {
        setSuccess(true);
        onSuccess?.();
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to join waitlist');
      }
    } catch (err) {
      setError('Failed to join waitlist');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (success) {
    return (
      <Card className={embedded ? '' : 'max-w-md mx-auto'}>
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            You're on the waitlist!
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We'll notify you as soon as a slot becomes available that matches your preferences.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={embedded ? '' : 'max-w-md mx-auto'}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Join Waitlist
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Get notified when a slot becomes available
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleInputChange}
              required
              className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="Enter your full name"
            />
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          <div className="relative">
            <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
              disabled={otpVerified}
              className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          
          {!otpVerified && (
            <div className="mt-2">
              {!otpSent ? (
                <button
                  type="button"
                  onClick={sendOTP}
                  disabled={submitting || !formData.phone}
                  className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400"
                >
                  {submitting ? 'Sending...' : 'Send verification code'}
                </button>
              ) : (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    name="otp_code"
                    value={formData.otp_code}
                    onChange={handleInputChange}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={verifyOTP}
                    disabled={submitting || !formData.otp_code}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {submitting ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {otpVerified && (
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">
              ✓ Phone number verified
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email (optional)
          </label>
          <div className="relative">
            <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="your@email.com"
            />
          </div>
        </div>

        {/* Service Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Service
          </label>
          <select
            name="service_id"
            value={formData.service_id}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Select a service</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.duration_minutes}min) - ${service.price}
              </option>
            ))}
          </select>
        </div>

        {/* Staff Preference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Staff Preference (optional)
          </label>
          <select
            name="staff_id"
            value={formData.staff_id}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Any staff member</option>
            {staff.map(member => (
              <option key={member.id} value={member.id}>
                {member.name} - {member.role}
              </option>
            ))}
          </select>
        </div>

        {/* Time Preferences */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Earliest Time
            </label>
            <div className="relative">
              <ClockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="datetime-local"
                name="earliest_time"
                value={formData.earliest_time}
                onChange={handleInputChange}
                required
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Latest Time
            </label>
            <div className="relative">
              <ClockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="datetime-local"
                name="latest_time"
                value={formData.latest_time}
                onChange={handleInputChange}
                required
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !otpVerified}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? <LoadingSpinner size="sm" /> : 'Join Waitlist'}
        </button>
      </form>
    </Card>
  );
};