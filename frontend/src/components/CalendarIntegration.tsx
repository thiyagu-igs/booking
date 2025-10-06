import React, { useState, useEffect } from 'react';
import { CalendarIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface CalendarSyncStatus {
  enabled: boolean;
  status: 'disabled' | 'enabled' | 'error';
  lastSync?: string;
  error?: string;
}

interface CalendarIntegrationProps {
  staffId: string;
  staffName: string;
}

export const CalendarIntegration: React.FC<CalendarIntegrationProps> = ({ staffId, staffName }) => {
  const [syncStatus, setSyncStatus] = useState<CalendarSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchSyncStatus();
  }, [staffId]);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch(`/api/calendar/status/${staffId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const status = await response.json();
        setSyncStatus(status);
      }
    } catch (error) {
      console.error('Failed to fetch calendar sync status:', error);
    }
  };

  const handleEnableSync = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/calendar/auth/${staffId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const { authUrl } = await response.json();
        // Open Google OAuth in a popup window
        const popup = window.open(
          authUrl,
          'google-calendar-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for the popup to close (user completed auth)
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            // Refresh status after auth completion
            setTimeout(() => {
              fetchSyncStatus();
              setLoading(false);
            }, 1000);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to initiate calendar sync:', error);
      setLoading(false);
    }
  };

  const handleDisableSync = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/calendar/sync/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await fetchSyncStatus();
      }
    } catch (error) {
      console.error('Failed to disable calendar sync:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch(`/api/calendar/test/${staffId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await fetchSyncStatus();
      } else {
        const error = await response.json();
        alert(`Connection test failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to test calendar connection:', error);
      alert('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (!syncStatus) return null;

    switch (syncStatus.status) {
      case 'enabled':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <XCircleIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!syncStatus) return 'Loading...';

    switch (syncStatus.status) {
      case 'enabled':
        return 'Connected';
      case 'error':
        return 'Error';
      default:
        return 'Not connected';
    }
  };

  const getStatusColor = () => {
    if (!syncStatus) return 'text-gray-500';

    switch (syncStatus.status) {
      case 'enabled':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <CalendarIcon className="h-6 w-6 text-blue-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">
            Google Calendar Integration
          </h3>
        </div>
        <div className="flex items-center">
          {getStatusIcon()}
          <span className={`ml-2 text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Staff Member: <span className="font-medium">{staffName}</span>
        </p>
        
        {syncStatus?.lastSync && (
          <p className="text-sm text-gray-600">
            Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
          </p>
        )}
        
        {syncStatus?.error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              <strong>Error:</strong> {syncStatus.error}
            </p>
          </div>
        )}
      </div>

      <div className="flex space-x-3">
        {!syncStatus?.enabled ? (
          <button
            onClick={handleEnableSync}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Connect Google Calendar'
            )}
          </button>
        ) : (
          <>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            
            <button
              onClick={handleDisableSync}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </>
        )}
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Automatically creates calendar events when slots are booked through the waitlist</li>
          <li>• Deletes calendar events when bookings are cancelled</li>
          <li>• Falls back to internal slot management if calendar sync fails</li>
          <li>• Includes customer information and booking details in calendar events</li>
        </ul>
      </div>
    </div>
  );
};