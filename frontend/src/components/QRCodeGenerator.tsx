import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Card } from './Card';
import { ClipboardDocumentIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

interface QRCodeGeneratorProps {
  className?: string;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const [qrValue, setQrValue] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.tenantId) {
      // Generate URL for customer waitlist signup
      const baseUrl = window.location.origin;
      const waitlistUrl = `${baseUrl}/customer/waitlist?tenant=${user.tenantId}`;
      setQrValue(waitlistUrl);
    }
  }, [user]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = 'waitlist-qr-code.png';
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  if (!qrValue) {
    return null;
  }

  return (
    <Card className={className}>
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <QrCodeIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Waitlist QR Code
          </h3>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Customers can scan this QR code to quickly join your waitlist
        </p>

        {/* QR Code */}
        <div className="flex justify-center mb-6 p-4 bg-white rounded-lg">
          <QRCode
            id="qr-code-svg"
            value={qrValue}
            size={200}
            level="M"
          />
        </div>

        {/* URL Display */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Waitlist URL
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={qrValue}
              readOnly
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              onClick={copyToClipboard}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
            >
              <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 justify-center">
          <button
            onClick={downloadQR}
            className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Download PNG
          </button>
          <button
            onClick={() => window.open(qrValue, '_blank')}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Preview Page
          </button>
        </div>

        {/* Usage Instructions */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            How to use:
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 text-left">
            <li>• Print and display the QR code in your business</li>
            <li>• Share the URL on social media or your website</li>
            <li>• Customers scan to instantly join your waitlist</li>
            <li>• No app download required - works in any browser</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};