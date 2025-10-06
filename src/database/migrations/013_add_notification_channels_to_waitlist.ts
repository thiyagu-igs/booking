import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('waitlist_entries', (table) => {
    // Add notification channel preferences
    table.json('notification_channels').nullable().comment('Array of preferred notification channels: ["email", "sms", "whatsapp"]');
    table.string('preferred_channel', 20).defaultTo('email').comment('Primary preferred notification channel');
    
    // Add index for preferred channel
    table.index(['preferred_channel'], 'idx_waitlist_preferred_channel');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('waitlist_entries', (table) => {
    table.dropIndex(['preferred_channel'], 'idx_waitlist_preferred_channel');
    table.dropColumn('notification_channels');
    table.dropColumn('preferred_channel');
  });
}