// Express app setup and configuration
// This file contains the Express application setup, middleware, and route configuration
// Swagger documentation will be configured here
require('dotenv').config();
const express = require('express');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes will be added here

module.exports = app;
