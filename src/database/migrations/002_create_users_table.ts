import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('email', 255).notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('name', 255).notNullable();
    table.enum('role', ['admin', 'staff', 'manager']).notNullable().defaultTo('staff');
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamp('last_login_at').nullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index(['tenant_id']);
    table.unique(['tenant_id', 'email']); // Email unique per tenant
    
    // Foreign key
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}