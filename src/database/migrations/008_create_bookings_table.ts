import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('bookings', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('slot_id', 36).notNullable();
    table.string('waitlist_entry_id', 36).nullable();
    table.string('customer_name', 255).notNullable();
    table.string('customer_phone', 20).notNullable();
    table.string('customer_email', 255).nullable();
    table.enum('status', ['confirmed', 'completed', 'no_show', 'canceled']).notNullable();
    table.enum('booking_source', ['waitlist', 'direct', 'walk_in']).notNullable();
    table.timestamp('confirmed_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('slot_id').references('id').inTable('slots').onDelete('CASCADE');
    table.foreign('waitlist_entry_id').references('id').inTable('waitlist_entries').onDelete('SET NULL');
    
    // Indexes
    table.index(['tenant_id'], 'idx_bookings_tenant');
    table.index(['slot_id'], 'idx_bookings_slot');
    table.index(['status'], 'idx_bookings_status');
    table.index(['booking_source'], 'idx_bookings_source');
    table.index(['customer_phone', 'tenant_id'], 'idx_bookings_customer_phone');
    table.index(['created_at'], 'idx_bookings_created_at');
    table.index(['tenant_id', 'status'], 'idx_bookings_tenant_status');
    
    // Unique constraint to prevent double booking of slots
    table.unique(['slot_id'], 'uk_bookings_slot');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('bookings');
}