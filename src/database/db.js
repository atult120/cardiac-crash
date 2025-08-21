const knex = require("knex");
const path = require("path");
const config = require("../config/config");

const db = knex({
  client: "mysql2",
  connection: {
    host : config.db.host,
    user : config.db.user,
    password : config.db.password,
    database : config.db.database
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, "migrations"),
  },
  seeds: {
    directory: path.join(__dirname, "seeds"),
  },
});

module.exports = db;