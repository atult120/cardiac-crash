exports.up = function(knex) {
  return knex.schema.table('sessions', function(table) {
    table.string('location');
  });
};

exports.down = function(knex) {
  return knex.schema.table('sessions', function(table) {
    table.dropColumn('location');
  });
};