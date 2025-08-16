const config = require('./src/config/config');

module.exports =  {
  development: {
    client: 'sqlite3',
    connection: {
      filename: config.db.db_path
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/migrations'
    },
    pool: {
      afterCreate: (conn, done) => conn.run('PRAGMA foreign_keys = ON', done)
    }
  }
};