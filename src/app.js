const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { handleError } = require('./utils/errorHandler');

// Import centralized routes
const routes = require('./routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(routes);

// Error handling middleware
app.use(handleError);

module.exports = app;