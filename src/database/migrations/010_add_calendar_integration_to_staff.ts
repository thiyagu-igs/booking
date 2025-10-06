import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('staff', (table) => {
    table.string('google_calendar_id', 255).nullable();
    table.text('google_refresh_token').nullable();
    table.timestamp('calendar_sync_enabled_at').nullable();
    table.timestamp('calendar_last_sync_at').nullable();
    table.string('calendar_sync_status', 50).defaultTo('disabled'); // disabled, enabled, error
    table.text('calendar_sync_error').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('staff', (table) => {
    table.dropColumn('google_calendar_id');
    table.dropColumn('google_refresh_token');
    table.dropColumn('calendar_sync_enabled_at');
    table.dropColumn('calendar_last_sync_at');
    table.dropColumn('calendar_sync_status');
    table.dropColumn('calendar_sync_error');
  });
}