import { api } from './api'
import { SAMPLE_TENANTS, getTenantBySubdomain } from '../config/tenants'

export interface Tenant {
  id: string
  name: string
  domain?: string
  timezone?: string
}

export class TenantService {
  private static readonly TENANT_STORAGE_KEY = 'selectedTenant'

  /**
   * Get tenant from URL subdomain or stored selection
   */
  static getTenantFromContext(): string | null {
    // First try to get from URL subdomain
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    
    // If subdomain exists and it's not 'www' or 'localhost'
    if (parts.length > 2 && parts[0] !== 'www' && hostname !== 'localhost') {
      const subdomain = parts[0]
      const tenant = getTenantBySubdomain(subdomain)
      return tenant?.id || null
    }

    // For localhost development, check if we have a stored tenant
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const stored = localStorage.getItem(this.TENANT_STORAGE_KEY)
      if (stored) return stored
      
      // Return first sample tenant for development
      return SAMPLE_TENANTS[0]?.id || null
    }

    // Fallback to stored tenant
    return localStorage.getItem(this.TENANT_STORAGE_KEY)
  }

  /**
   * Store selected tenant
   */
  static setSelectedTenant(tenantId: string): void {
    localStorage.setItem(this.TENANT_STORAGE_KEY, tenantId)
  }

  /**
   * Clear stored tenant
   */
  static clearSelectedTenant(): void {
    localStorage.removeItem(this.TENANT_STORAGE_KEY)
  }

  /**
   * Validate if tenant ID is a valid UUID format
   */
  static isValidTenantId(tenantId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(tenantId)
  }

  /**
   * Get available tenants from database
   */
  static async getAvailableTenants(): Promise<Tenant[]> {
    try {
      const response = await api.get('/public/tenants')
      return response.data.data || []
    } catch (error) {
      console.warn('Could not fetch available tenants, using sample data:', error)
      // Return sample tenants for development
      return SAMPLE_TENANTS.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain
      }))
    }
  }
}