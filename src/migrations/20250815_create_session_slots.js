exports.up = function(knex) {
  return knex.schema.createTable('session_slots', function(table) {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable().references('id').inTable('sessions').onDelete('CASCADE');
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.string('start_time').notNullable();
    table.string('end_time').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('session_slots');
};