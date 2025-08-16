const knex = require("knex");
const path = require("path");
const config = require("../config/config");

const db = knex({
  client: "sqlite3",
  connection: {
    filename: config.db.db_path
  },
  useNullAsDefault: true, // required for SQLite
  migrations: {
    directory: path.join(__dirname, "migrations"),
  },
  seeds: {
    directory: path.join(__dirname, "seeds"),
  },
});

module.exports = db;