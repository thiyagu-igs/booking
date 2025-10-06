import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('services').del();

  // Insert sample services
  await knex('services').insert([
    // Bella Vista Salon Services
    {
      id: '880e8400-e29b-41d4-a716-446655440001',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Haircut & Style',
      duration_minutes: 60,
      price: 65.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440002',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Hair Color',
      duration_minutes: 120,
      price: 120.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440003',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Highlights',
      duration_minutes: 150,
      price: 150.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440004',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Blowout',
      duration_minutes: 45,
      price: 45.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },

    // Downtown Barbershop Services
    {
      id: '880e8400-e29b-41d4-a716-446655440005',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Classic Haircut',
      duration_minutes: 30,
      price: 25.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440006',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Beard Trim',
      duration_minutes: 20,
      price: 15.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440007',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Hot Towel Shave',
      duration_minutes: 45,
      price: 35.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440008',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Haircut & Beard Package',
      duration_minutes: 45,
      price: 35.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },

    // Elite Spa & Wellness Services
    {
      id: '880e8400-e29b-41d4-a716-446655440009',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Swedish Massage',
      duration_minutes: 60,
      price: 90.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440010',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Deep Tissue Massage',
      duration_minutes: 90,
      price: 130.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440011',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'European Facial',
      duration_minutes: 75,
      price: 85.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440012',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Manicure & Pedicure',
      duration_minutes: 90,
      price: 65.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440013',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Body Wrap',
      duration_minutes: 120,
      price: 110.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440014',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Wellness Consultation',
      duration_minutes: 45,
      price: 75.00,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
}