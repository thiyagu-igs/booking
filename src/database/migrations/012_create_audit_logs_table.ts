import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('tenant_id').notNullable();
    table.uuid('user_id').nullable(); // Nullable for system actions
    table.string('actor_type', 50).notNullable(); // 'user', 'system', 'api'
    table.string('actor_id', 255).nullable(); // User ID, system process, API key ID
    table.string('action', 100).notNullable(); // CREATE, UPDATE, DELETE, LOGIN, etc.
    table.string('resource_type', 100).notNullable(); // waitlist_entry, slot, user, etc.
    table.uuid('resource_id').nullable(); // ID of the affected resource
    table.json('old_values').nullable(); // Previous state for updates
    table.json('new_values').nullable(); // New state for creates/updates
    table.json('metadata').nullable(); // Additional context (IP, user agent, etc.)
    table.string('ip_address', 45).nullable(); // IPv4 or IPv6
    table.string('user_agent', 500).nullable();
    table.enum('severity', ['low', 'medium', 'high', 'critical']).defaultTo('low');
    table.boolean('success').defaultTo(true);
    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for efficient querying
    table.index(['tenant_id', 'created_at']);
    table.index(['user_id', 'created_at']);
    table.index(['action', 'resource_type']);
    table.index(['severity', 'created_at']);
    table.index(['success', 'created_at']);

    // Foreign key constraints
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('audit_logs');
}