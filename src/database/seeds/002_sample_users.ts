import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('users').del();

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);

  // Insert sample users
  await knex('users').insert([
    // Bella Vista Salon Users
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'admin@bellavista.com',
      password_hash: adminPassword,
      name: 'Sarah Johnson',
      role: 'admin',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440002',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'manager@bellavista.com',
      password_hash: managerPassword,
      name: 'Maria Rodriguez',
      role: 'manager',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440003',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'emily@bellavista.com',
      password_hash: staffPassword,
      name: 'Emily Chen',
      role: 'staff',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440004',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'jessica@bellavista.com',
      password_hash: staffPassword,
      name: 'Jessica Williams',
      role: 'staff',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },

    // Downtown Barbershop Users
    {
      id: '660e8400-e29b-41d4-a716-446655440005',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'admin@downtownbarber.com',
      password_hash: adminPassword,
      name: 'Mike Thompson',
      role: 'admin',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440006',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'tony@downtownbarber.com',
      password_hash: staffPassword,
      name: 'Tony Martinez',
      role: 'staff',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440007',
      tenant_id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'carlos@downtownbarber.com',
      password_hash: staffPassword,
      name: 'Carlos Rivera',
      role: 'staff',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },

    // Elite Spa & Wellness Users
    {
      id: '660e8400-e29b-41d4-a716-446655440008',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      email: 'admin@elitespa.com',
      password_hash: adminPassword,
      name: 'Amanda Foster',
      role: 'admin',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440009',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      email: 'manager@elitespa.com',
      password_hash: managerPassword,
      name: 'Lisa Park',
      role: 'manager',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440010',
      tenant_id: '550e8400-e29b-41d4-a716-446655440003',
      email: 'sophia@elitespa.com',
      password_hash: staffPassword,
      name: 'Sophia Davis',
      role: 'staff',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
}