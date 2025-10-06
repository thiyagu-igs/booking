import { useState, useEffect, useRef } from 'react'
import { TenantService, Tenant } from '../services/tenant'

interface TenantSelectorProps {
  value: string
  onChange: (tenantId: string) => void
  error?: string
}

export default function TenantSelector({ value, onChange, error }: TenantSelectorProps) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTenants()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTenants = async () => {
    setLoading(true)
    try {
      const availableTenants = await TenantService.getAvailableTenants()
      setTenants(availableTenants)
    } catch (error) {
      console.error('Failed to load tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTenantSelect = (tenant: Tenant) => {
    onChange(tenant.id)
    setShowDropdown(false)
  }

  const selectedTenant = tenants.find(t => t.id === value)

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Organization
      </label>
      
      <div className="relative">
        <input
          type="text"
          className={`input-field pr-10 ${error ? 'border-red-500' : ''}`}
          placeholder="Enter tenant ID or select from list"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
        />
        
        {tenants.length > 0 && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && tenants.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading ? (
            <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
          ) : (
            tenants.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
                onClick={() => handleTenantSelect(tenant)}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {tenant.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {tenant.timezone && <span className="mr-2">🌍 {tenant.timezone}</span>}
                  <span className="font-mono">{tenant.id}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {selectedTenant && (
        <div className="mt-1 text-xs text-green-600 dark:text-green-400">
          Selected: {selectedTenant.name}
        </div>
      )}

      {error && (
        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      </div>
    </div>
  )
}