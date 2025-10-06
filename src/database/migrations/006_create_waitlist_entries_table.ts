import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('waitlist_entries', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('customer_name', 255).notNullable();
    table.string('phone', 20).notNullable();
    table.string('email', 255).nullable();
    table.string('service_id', 36).notNullable();
    table.string('staff_id', 36).nullable(); // nullable for any staff preference
    table.timestamp('earliest_time').notNullable();
    table.timestamp('latest_time').notNullable();
    table.integer('priority_score').notNullable();
    table.boolean('vip_status').defaultTo(false);
    table.enum('status', ['active', 'notified', 'confirmed', 'removed']).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('service_id').references('id').inTable('services').onDelete('CASCADE');
    table.foreign('staff_id').references('id').inTable('staff').onDelete('SET NULL');
    
    // Indexes
    table.index(['tenant_id'], 'idx_waitlist_tenant');
    table.index(['status'], 'idx_waitlist_status');
    table.index(['priority_score', 'created_at'], 'idx_waitlist_priority');
    table.index(['tenant_id', 'status'], 'idx_waitlist_tenant_status');
    table.index(['phone', 'tenant_id'], 'idx_waitlist_phone_tenant');
    table.index(['service_id'], 'idx_waitlist_service');
    table.index(['earliest_time', 'latest_time'], 'idx_waitlist_time_window');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('waitlist_entries');
}