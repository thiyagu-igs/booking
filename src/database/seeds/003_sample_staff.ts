import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('staff').del();

  // Insert sample staff
  await knex('staff').insert([
    // Bella Vista Salon Staff
    {
      id: '770e8400-e29b-41d4-a716-446655440001',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Emily Chen',
      role: 'Hair Stylist',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440002',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Jessica Williams',
      role: 'Color Specialist',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440003',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Maria Rodriguez',
      role: 'Senior Stylist',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },

    // Downtown Barbershop Staff
    {
      id: '770e8400-e29b-41d4-a716-446655440004',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Tony Martinez',
      role: 'Master Barber',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440005',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Carlos Rivera',
      role: 'Barber',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440006',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Jake Wilson',
      role: 'Junior Barber',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },

    // Elite Spa & Wellness Staff
    {
      id: '770e8400-e29b-41d4-a716-446655440007',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Sophia Davis',
      role: 'Massage Therapist',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440008',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Lisa Park',
      role: 'Esthetician',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440009',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Rachel Green',
      role: 'Nail Technician',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440010',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Jennifer Lee',
      role: 'Wellness Coach',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
}