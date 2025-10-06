import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('staff', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('name', 255).notNullable();
    table.string('role', 100).nullable();
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    
    // Indexes
    table.index(['tenant_id'], 'idx_staff_tenant');
    table.index(['tenant_id', 'active'], 'idx_staff_tenant_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('staff');
}