import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('calendar_events', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('slot_id', 36).notNullable();
    table.string('staff_id', 36).notNullable();
    table.string('google_event_id', 255).notNullable();
    table.string('google_calendar_id', 255).notNullable();
    table.string('status', 50).notNullable(); // created, updated, deleted, error
    table.text('sync_error').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('slot_id').references('id').inTable('slots').onDelete('CASCADE');
    table.foreign('staff_id').references('id').inTable('staff').onDelete('CASCADE');
    
    // Indexes
    table.index(['tenant_id'], 'idx_calendar_events_tenant');
    table.index(['slot_id'], 'idx_calendar_events_slot');
    table.index(['staff_id'], 'idx_calendar_events_staff');
    table.index(['google_event_id'], 'idx_calendar_events_google_id');
    
    // Unique constraint to prevent duplicate events
    table.unique(['slot_id', 'google_event_id'], 'uk_calendar_events_slot_google');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('calendar_events');
}