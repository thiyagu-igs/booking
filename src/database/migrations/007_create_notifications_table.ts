import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('notifications', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('waitlist_entry_id', 36).notNullable();
    table.string('slot_id', 36).notNullable();
    table.enum('type', ['email', 'sms', 'whatsapp']).notNullable();
    table.string('recipient', 255).notNullable();
    table.string('subject', 500).nullable();
    table.text('message').notNullable();
    table.enum('status', ['pending', 'sent', 'delivered', 'failed']).notNullable();
    table.timestamp('sent_at').nullable();
    table.timestamp('delivered_at').nullable();
    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('waitlist_entry_id').references('id').inTable('waitlist_entries').onDelete('CASCADE');
    table.foreign('slot_id').references('id').inTable('slots').onDelete('CASCADE');
    
    // Indexes
    table.index(['tenant_id'], 'idx_notifications_tenant');
    table.index(['status'], 'idx_notifications_status');
    table.index(['waitlist_entry_id'], 'idx_notifications_waitlist_entry');
    table.index(['slot_id'], 'idx_notifications_slot');
    table.index(['created_at'], 'idx_notifications_created_at');
    table.index(['tenant_id', 'status'], 'idx_notifications_tenant_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('notifications');
}