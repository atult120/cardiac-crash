async function up(knex) {
  await knex.schema
    .createTable('sessions', (t) => {
      t.increments('id').primary();
      t.integer('docebo_user_id').notNullable().index();
      t.string('cal_event_type_id').notNullable().index();
      t.string('reservation_id').nullable().index();
      t.string('booking_url').nullable();
      t.string('title').notNullable().index();
      t.text('description').nullable();
      t.integer('duration').notNullable();
      t.string('slug').nullable();
      t.string('username').nullable();
      t.timestamp('start_date').nullable();
      t.timestamp('end_date').nullable();
      t.timestamp('start_time').nullable();
      t.timestamp('end_time').nullable();
      t.timestamps(true, true);
    })
}

async function down(knex) {
  await knex.schema
    .dropTableIfExists('participants')
    .dropTableIfExists('sessions');
}

module.exports = { up, down };