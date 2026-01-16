// Entry point - starts the server
// This file imports the server and starts listening on the configured port
require('dotenv').config();
const { testConnection } = require('./config/database');
const { initializeUsersTable } = require('./models/User');
const app = require('./server');

const PORT = process.env.PORT || 3000;

// Start server with database connection check
const startServer = async () => {
  // Test database connection
  console.log('\n🔌 Testing database connection...');
  const dbStatus = await testConnection();
  
  if (dbStatus.success) {
    console.log('✅ Database connected successfully');
    console.log(`   Server time: ${dbStatus.timestamp}`);
    
    // Initialize database tables
    try {
      await initializeUsersTable();
    } catch (error) {
      console.log('⚠️  Warning: Could not initialize users table');
      console.log(`   Error: ${error.message}\n`);
    }
  } else {
    console.log('❌ Database connection failed');
    console.log(`   Error: ${dbStatus.error}`);
    console.log('   Server will start but database operations may fail\n');
  }

  // Start the server
  app.listen(PORT, () => {
    console.log(`\n🚀 Server is running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   API Docs: http://localhost:${PORT}/api-docs\n`);
  });
};

startServer();
