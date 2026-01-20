// Entry point - starts the server
// This file imports the server and starts listening on the configured port
require('dotenv').config();
const { testConnection } = require('./config/database');
const { initializeUsersTable } = require('./models/User');
const { initializeProfilesTable } = require('./models/Profile');
const { initializeMedicalOrganizationsTable } = require('./models/MedicalOrganization');
const { initializeMedicalSkillsTable } = require('./models/MedicalSkill');
const { initializeMedicalExperiencesTable } = require('./models/MedicalExperience');
const { initializeMedicalEducationTable } = require('./models/MedicalEducation');
const { initializeUserSkillsTable } = require('./models/UserSkill');
const { initializeMedicalCertificationsTable } = require('./models/MedicalCertification');
const { initializeMedicalPublicationsTable } = require('./models/MedicalPublication');
const { initializeMedicalProjectsTable } = require('./models/MedicalProject');
const { initializeAwardsTable } = require('./models/Award');
const { initializeConnectionsTable } = require('./models/Connection');
const { initializeRecommendationsTable } = require('./models/Recommendation');
const { initializeFollowsTable } = require('./models/Follow');
const { initializeConversationsTable } = require('./models/Conversation');
const { initializeMessagesTable } = require('./models/Message');
const { initializeMedicalGroupsTable } = require('./models/MedicalGroup');
const { initializeGroupMembershipsTable } = require('./models/GroupMembership');
const { initializePostsTable } = require('./models/Post');
const { initializePostMediaTable } = require('./models/PostMedia');
const { initializeCommentsTable } = require('./models/Comment');
const { initializeReactionsTable } = require('./models/Reaction');
const { initializeSharesTable } = require('./models/Share');
const { initializeHashtagsTable } = require('./models/Hashtag');
const { initializePostHashtagsTable } = require('./models/PostHashtag');
const { initializeJobPostingsTable } = require('./models/JobPosting');
const { initializeJobApplicationsTable } = require('./models/JobApplication');
const { initializeSavedJobsTable } = require('./models/SavedJob');
const { initializeJobSkillsTable } = require('./models/JobSkill');
const { initializeActivityFeedTable } = require('./models/ActivityFeed');
const { initializeNotificationsTable } = require('./models/Notification');
const { initializeNotificationPreferencesTable } = require('./models/NotificationPreference');
const { initializeProfileSettingsTable } = require('./models/ProfileSettings');
const { testConnection: testRedisConnection } = require('./config/redis');
const { initializeSocketIO } = require('./services/socketService');
const { addIndexes } = require('./migrations/addIndexes');
const { setupUnhandledRejectionHandler, setupUncaughtExceptionHandler } = require('./middleware/errorMiddleware');
const { createEmailWorker } = require('./jobs/emailJob');
const app = require('./server');
const http = require('http');

// Setup global error handlers
setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

const PORT = process.env.PORT || 3000;

// Start server with database connection check
const startServer = async () => {
  // Test database connection
  console.log('\n🔌 Testing database connection...');
  const dbStatus = await testConnection();
  
  if (dbStatus.success) {
    console.log('✅ Database connected successfully');
    console.log(`   Server time: ${dbStatus.timestamp}`);
    
    // Initialize database tables (in dependency order)
    try {
      console.log('\n📊 Initializing database tables...\n');
      
      // Core tables
      await initializeUsersTable();
      await initializeProfilesTable();
      await initializeMedicalOrganizationsTable();
      await initializeMedicalSkillsTable();
      
      // Professional experience tables
      await initializeMedicalExperiencesTable();
      await initializeMedicalEducationTable();
      await initializeUserSkillsTable();
      await initializeMedicalCertificationsTable();
      await initializeMedicalPublicationsTable();
      await initializeMedicalProjectsTable();
      await initializeAwardsTable();
      
      // Network and social tables
      await initializeConnectionsTable();
      await initializeRecommendationsTable();
      await initializeFollowsTable();
      await initializeConversationsTable();
      await initializeMessagesTable();
      
      // Group tables
      await initializeMedicalGroupsTable();
      await initializeGroupMembershipsTable();
      
      // Content and engagement tables
      await initializePostsTable();
      await initializePostMediaTable();
      await initializeCommentsTable();
      await initializeReactionsTable();
      await initializeSharesTable();
      await initializeHashtagsTable();
      await initializePostHashtagsTable();
      
      // Job and career tables
      await initializeJobPostingsTable();
      await initializeJobApplicationsTable();
      await initializeSavedJobsTable();
      await initializeJobSkillsTable();
      
      // Activity and notification tables
      await initializeActivityFeedTable();
      await initializeNotificationsTable();
      await initializeNotificationPreferencesTable();
      await initializeProfileSettingsTable();
      
      console.log('\n✅ All database tables initialized successfully\n');
      
      // Create database indexes for performance optimization
      try {
        console.log('📊 Creating database indexes...\n');
        await addIndexes();
        console.log('✅ Database indexes created successfully\n');
      } catch (error) {
        console.log('⚠️  Warning: Could not create some database indexes');
        console.log(`   Error: ${error.message}\n`);
      }
    } catch (error) {
      console.log('⚠️  Warning: Could not initialize some database tables');
      console.log(`   Error: ${error.message}\n`);
    }
  } else {
    console.log('❌ Database connection failed');
    console.log(`   Error: ${dbStatus.error}`);
    console.log('   Server will start but database operations may fail\n');
  }

  // Test Redis connection (optional, don't fail if Redis is not available)
  if (process.env.REDIS_HOST) {
    console.log('\n🔌 Testing Redis connection...');
    const redisStatus = await testRedisConnection();
    if (redisStatus.success) {
      console.log('✅ Redis connected successfully');
    } else {
      console.log('⚠️  Redis connection failed (will continue without caching/real-time features)');
      console.log(`   Error: ${redisStatus.error || 'Connection timeout'}\n`);
    }
  }

  // Create HTTP server
  const httpServer = http.createServer(app);

  // Initialize Socket.io (only if Redis is enabled or WebSocket is enabled)
  if (process.env.WS_ENABLED !== 'false') {
    try {
      await initializeSocketIO(httpServer);
    } catch (error) {
      console.log('⚠️  Socket.io initialization failed:', error.message);
      console.log('   Server will continue without WebSocket support\n');
    }
  }

  // Initialize job workers (only if Redis is available)
  if (process.env.REDIS_HOST) {
    try {
      const emailWorker = createEmailWorker();
      console.log('✅ Email worker started\n');
    } catch (error) {
      console.log('⚠️  Job workers initialization failed:', error.message);
      console.log('   Server will continue without background job processing\n');
    }
  }

  // Start the server
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server is running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   API Docs: http://localhost:${PORT}/api-docs`);
    if (process.env.WS_ENABLED !== 'false') {
      console.log(`   WebSocket: Enabled\n`);
    } else {
      console.log(`   WebSocket: Disabled\n`);
    }
  });
};

startServer();
