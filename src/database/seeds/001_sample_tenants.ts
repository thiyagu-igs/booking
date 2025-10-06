import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('tenants').del();

  // Insert sample tenants
  await knex('tenants').insert([
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Bella Vista Salon',
      timezone: 'America/New_York',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002', 
      name: 'Downtown Barbershop',
      timezone: 'America/Los_Angeles',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Elite Spa & Wellness',
      timezone: 'America/Chicago',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
}