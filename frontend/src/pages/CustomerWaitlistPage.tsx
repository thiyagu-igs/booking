import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CustomerWaitlistForm } from '../components/CustomerWaitlistForm';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { 
  BuildingStorefrontIcon, 
  ClockIcon, 
  PhoneIcon, 
  MapPinIcon,
  StarIcon
} from '@heroicons/react/24/outline';

interface BusinessInfo {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  hours?: string;
  rating?: number;
  logo?: string;
}

export const CustomerWaitlistPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant');
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) {
      loadBusinessInfo();
    } else {
      setError('Invalid business link');
      setLoading(false);
    }
  }, [tenantId]);

  const loadBusinessInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/business/${tenantId}`);
      
      if (response.ok) {
        const data = await response.json();
        setBusinessInfo(data);
      } else {
        setError('Business not found');
      }
    } catch (err) {
      setError('Failed to load business information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !businessInfo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md mx-auto text-center">
          <div className="p-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {error || 'Business Not Found'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Please check the link and try again, or contact the business directly.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            {businessInfo.logo ? (
              <img
                src={businessInfo.logo}
                alt={businessInfo.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <BuildingStorefrontIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {businessInfo.name}
              </h1>
              {businessInfo.description && (
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {businessInfo.description}
                </p>
              )}
              
              {/* Business Details */}
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {businessInfo.rating && (
                  <div className="flex items-center">
                    <StarIcon className="h-4 w-4 text-yellow-400 mr-1" />
                    <span>{businessInfo.rating.toFixed(1)}</span>
                  </div>
                )}
                
                {businessInfo.phone && (
                  <div className="flex items-center">
                    <PhoneIcon className="h-4 w-4 mr-1" />
                    <span>{businessInfo.phone}</span>
                  </div>
                )}
                
                {businessInfo.address && (
                  <div className="flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    <span>{businessInfo.address}</span>
                  </div>
                )}
                
                {businessInfo.hours && (
                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    <span>{businessInfo.hours}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Waitlist Form */}
          <div className="lg:col-span-2">
            <CustomerWaitlistForm 
              tenantId={tenantId!} 
              embedded={true}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* How it Works */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  How it works
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Join the waitlist</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fill out your preferences and contact info</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Get notified</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">We'll text/email when a slot opens up</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Confirm quickly</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Click to confirm or decline the slot</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* FAQ */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Frequently Asked
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      How long do I have to respond?
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      You have 15 minutes to confirm or decline when notified.
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Can I join multiple waitlists?
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Yes, you can join up to 3 waitlists at the same time.
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Is there a cost to join?
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No, joining the waitlist is completely free.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Contact Info */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Need Help?
                </h3>
                <div className="space-y-3">
                  {businessInfo.phone && (
                    <div className="flex items-center space-x-2">
                      <PhoneIcon className="h-4 w-4 text-gray-400" />
                      <a 
                        href={`tel:${businessInfo.phone}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {businessInfo.phone}
                      </a>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Contact the business directly if you have questions about your appointment or need to make changes.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Powered by Waitlist Management System</p>
            <p className="mt-1">
              Helping businesses fill last-minute openings automatically
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};