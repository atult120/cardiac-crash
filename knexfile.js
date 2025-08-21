const config = require('./src/config/config');

module.exports =  {
  development: {
    client: 'mysql2',
    connection: {
      host : config.db.host,
      user : config.db.user,
      password : config.db.password,
      database : config.db.database
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/migrations'
    }
  }
};