import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('slots', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('staff_id', 36).notNullable();
    table.string('service_id', 36).notNullable();
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.enum('status', ['open', 'held', 'booked', 'canceled']).notNullable();
    table.timestamp('hold_expires_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('staff_id').references('id').inTable('staff').onDelete('CASCADE');
    table.foreign('service_id').references('id').inTable('services').onDelete('CASCADE');
    
    // Indexes
    table.index(['tenant_id'], 'idx_slots_tenant');
    table.index(['start_time', 'end_time'], 'idx_slots_time');
    table.index(['status'], 'idx_slots_status');
    table.index(['tenant_id', 'status'], 'idx_slots_tenant_status');
    table.index(['staff_id', 'start_time'], 'idx_slots_staff_time');
    
    // Unique constraint to prevent double booking
    table.unique(['staff_id', 'start_time', 'end_time'], 'uk_slots_staff_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('slots');
}