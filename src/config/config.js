require('dotenv').config();
module.exports = {
  docebo: {
    baseUrl: process.env.DOCEBO_BASE_URL,
    accessToken: process.env.DOCEBO_ACCESS_TOKEN,
    clientId: process.env.DOCEBO_CLIENT_ID,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
    username: process.env.DOCEBO_USERNAME,
    password: process.env.DOCEBO_PASSWORD,
    // SSO Configuration
    ssoSecret: process.env.DOCEBO_SSO_SECRET,
  },
  db : {
    host : process.env.DB_HOST,
    user : process.env.DB_USER,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE,
  },
  calcom : {
    baseUrl : process.env.CAL_BASE_URL,
    apiKey : process.env.CAL_API_KEY
  },
  port: process.env.PORT || 3000,
  calendly : {
    baseUrl : process.env.CALENDELY_BASE_URL,
    apiKey : process.env.CALENDELY_API_KEY
  }
};