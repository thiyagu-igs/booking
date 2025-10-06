import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('audit_logs', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.enum('actor_type', ['user', 'system']).notNullable();
    table.string('actor_id', 36).nullable();
    table.string('action', 255).notNullable();
    table.string('resource_type', 100).notNullable();
    table.string('resource_id', 36).notNullable();
    table.json('old_values').nullable();
    table.json('new_values').nullable();
    table.json('metadata').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    
    // Indexes
    table.index(['tenant_id'], 'idx_audit_logs_tenant');
    table.index(['actor_type', 'actor_id'], 'idx_audit_logs_actor');
    table.index(['action'], 'idx_audit_logs_action');
    table.index(['resource_type', 'resource_id'], 'idx_audit_logs_resource');
    table.index(['created_at'], 'idx_audit_logs_created_at');
    table.index(['tenant_id', 'created_at'], 'idx_audit_logs_tenant_created');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('audit_logs');
}