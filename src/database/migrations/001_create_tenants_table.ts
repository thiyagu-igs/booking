import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('tenants', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 255).notNullable();
    table.string('timezone', 50).notNullable().defaultTo('UTC');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Indexes
    table.index(['name'], 'idx_tenants_name');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('tenants');
}