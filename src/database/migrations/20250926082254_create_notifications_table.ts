import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.string('id', 36).primary();
    table.string('tenant_id', 36).notNullable();
    table.string('waitlist_entry_id', 36).notNullable();
    table.string('slot_id', 36).notNullable();
    table.enum('type', ['email', 'sms', 'whatsapp']).notNullable();
    table.string('recipient').notNullable();
    table.string('subject').nullable();
    table.text('message').notNullable();
    table.enum('status', ['pending', 'sent', 'delivered', 'failed']).notNullable();
    table.timestamp('sent_at').nullable();
    table.timestamp('delivered_at').nullable();
    table.text('error_message').nullable();
    table.timestamps(true, true);

    // Foreign key constraints
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('waitlist_entry_id').references('id').inTable('waitlist_entries').onDelete('CASCADE');
    table.foreign('slot_id').references('id').inTable('slots').onDelete('CASCADE');

    // Indexes for performance
    table.index(['tenant_id']);
    table.index(['waitlist_entry_id']);
    table.index(['slot_id']);
    table.index(['status']);
    table.index(['created_at']);
    table.index(['tenant_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}

