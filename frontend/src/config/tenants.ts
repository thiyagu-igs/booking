// Sample tenant configurations for development
// In production, these would come from your backend API

export interface TenantConfig {
  id: string
  name: string
  domain?: string
  subdomain?: string
}

export const SAMPLE_TENANTS: TenantConfig[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Demo Restaurant',
    subdomain: 'demo',
    domain: 'demo.waitlist.com'
  },
  {
    id: '987fcdeb-51a2-43d1-9f12-123456789abc',
    name: 'Test Clinic',
    subdomain: 'clinic',
    domain: 'clinic.waitlist.com'
  }
]

// Helper function to get tenant by subdomain
export function getTenantBySubdomain(subdomain: string): TenantConfig | undefined {
  return SAMPLE_TENANTS.find(tenant => tenant.subdomain === subdomain)
}

// Helper function to get tenant by ID
export function getTenantById(id: string): TenantConfig | undefined {
  return SAMPLE_TENANTS.find(tenant => tenant.id === id)
}