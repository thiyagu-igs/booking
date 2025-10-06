import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('whatsapp_templates', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('tenant_id', 36).notNullable();
    table.string('template_name', 255).notNullable().comment('WhatsApp template name registered with Meta');
    table.string('template_language', 10).notNullable().defaultTo('en').comment('Template language code');
    table.enum('template_category', ['MARKETING', 'UTILITY', 'AUTHENTICATION']).notNullable().defaultTo('UTILITY');
    table.enum('status', ['pending', 'approved', 'rejected', 'disabled']).notNullable().defaultTo('pending');
    table.json('template_components').notNullable().comment('WhatsApp template structure with header, body, footer, buttons');
    table.text('rejection_reason').nullable().comment('Reason for template rejection by Meta');
    table.timestamp('submitted_at').nullable().comment('When template was submitted to Meta for approval');
    table.timestamp('approved_at').nullable().comment('When template was approved by Meta');
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    
    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    
    // Indexes
    table.index(['tenant_id'], 'idx_whatsapp_templates_tenant');
    table.index(['status'], 'idx_whatsapp_templates_status');
    table.index(['tenant_id', 'status'], 'idx_whatsapp_templates_tenant_status');
    table.unique(['tenant_id', 'template_name', 'template_language'], 'uk_whatsapp_templates_unique');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('whatsapp_templates');
}