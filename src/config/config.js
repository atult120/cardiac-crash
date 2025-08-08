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
  },
  port: process.env.PORT || 3000
};