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
const { initializeBlocksTable } = require('./models/Block');
const { initializeRecommendationsTable } = require('./models/Recommendation');
const { initializeFollowsTable } = require('./models/Follow');
const { initializeConversationsTable } = require('./models/Conversation');
const { initializeMessagesTable } = require('./models/Message');
const { initializeMessageReactionsTable } = require('./models/MessageReaction');
const { initializeUserOnlineStatusTable } = require('./models/UserOnlineStatus');
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
const { initializeProfileVisitorsTable } = require('./models/ProfileVisitors');
const { initializeNotificationsTable } = require('./models/Notification');
const { initializeNotificationPreferencesTable } = require('./models/NotificationPreference');
const { initializeProfileSettingsTable } = require('./models/ProfileSettings');
const { testConnection: testRedisConnection } = require('./config/redis');
const { initializeContainers: initializeAzureContainers } = require('./config/azureStorage');
const { initializeSocketIO } = require('./services/socketService');
const { addIndexes } = require('./migrations/addIndexes');
const { setupUnhandledRejectionHandler, setupUncaughtExceptionHandler } = require('./middleware/errorMiddleware');
const { createEmailWorker } = require('./jobs/emailJob');
const { createImageProcessingWorker } = require('./jobs/imageProcessingJob');
const { createVideoProcessingWorker } = require('./jobs/videoProcessingJob');
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
      await initializeBlocksTable();
      await initializeRecommendationsTable();
      await initializeFollowsTable();
      await initializeConversationsTable();
      await initializeMessagesTable();
      await initializeMessageReactionsTable();
      await initializeUserOnlineStatusTable();
      
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
      await initializeProfileVisitorsTable();
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
  if (process.env.REDIS_CONNECTION_STRING || process.env.REDIS_HOST) {
    console.log('\n🔌 Testing Redis connection...');
    const redisStatus = await testRedisConnection();
    if (redisStatus.success) {
      console.log('✅ Redis connected successfully');
    } else {
      console.log('⚠️  Redis connection failed (will continue without caching/real-time features)');
      console.log(`   Error: ${redisStatus.error || 'Connection timeout'}\n`);
    }
  }

  // Initialize Azure Blob Storage containers
  if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.log('\n🔌 Initializing Azure Blob Storage containers...');
    try {
      console.log('📍 Step 1.1: Calling initializeAzureContainers()...');
      await initializeAzureContainers();
      console.log('✅ Azure Blob Storage containers initialized\n');
    } catch (error) {
      console.log('⚠️  Azure Blob Storage initialization failed');
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
      console.log('   Server will continue without Azure Blob Storage\n');
    }
  } else {
    console.log('\n⚠️  Azure Blob Storage not configured (AZURE_STORAGE_CONNECTION_STRING missing)');
    console.log('   Media upload features will be unavailable\n');
  }

  console.log('📍 Step 2: Azure containers complete, creating HTTP server...');

  // Create HTTP server
  let httpServer;
  try {
    console.log('📍 Step 2.1: Creating HTTP server...');
    httpServer = http.createServer(app);
    console.log('✅ HTTP server created');
  } catch (error) {
    console.error('❌ Failed to create HTTP server:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    throw error;
  }

  console.log('📍 Step 3: HTTP server created, initializing Socket.io...');

  // Initialize Socket.io (only if Redis is enabled or WebSocket is enabled)
  if (process.env.WS_ENABLED !== 'false') {
    try {
      console.log('📍 Step 3.1: Calling initializeSocketIO()...');
      await initializeSocketIO(httpServer);
      console.log('✅ Socket.io initialized');
    } catch (error) {
      console.log('⚠️  Socket.io initialization failed:', error.message);
      if (error.stack) {
        console.log('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
      }
      console.log('   Server will continue without WebSocket support\n');
    }
  }

  console.log('📍 Step 4: Socket.io complete, initializing job workers...');

  // Initialize job workers (only if Redis is available)
  if (process.env.REDIS_CONNECTION_STRING || process.env.REDIS_HOST) {
    try {
      console.log('📍 Step 4.1: Creating email worker...');
      const emailWorker = createEmailWorker();
      console.log('✅ Email worker started');
      
      // Start media processing workers (only if Azure is configured)
      if (process.env.AZURE_STORAGE_CONNECTION_STRING && (process.env.REDIS_CONNECTION_STRING || process.env.REDIS_HOST)) {
        try {
          console.log('📍 Step 4.2: Creating image processing worker...');
          const imageWorker = createImageProcessingWorker();
          console.log('✅ Image processing worker created');
          
          console.log('📍 Step 4.3: Creating video processing worker...');
          const videoWorker = createVideoProcessingWorker();
          console.log('✅ Video processing worker created');
          
          console.log('✅ Media processing workers started\n');
        } catch (error) {
          console.log('⚠️  Media processing workers failed to start');
          console.log(`   Error: ${error.message}`);
          if (error.stack) {
            console.log(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
          }
          console.log('   Server will continue without media processing workers\n');
        }
      }
    } catch (error) {
      console.log('⚠️  Job workers initialization failed');
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
      console.log('   Server will continue without background job processing\n');
    }
  }

  console.log('📍 Step 5: All initialization complete, starting HTTP server...');

  // Start the server
  try {
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

    httpServer.on('error', (error) => {
      console.error('❌ HTTP Server error:', error.message);
      if (error.code === 'EADDRINUSE') {
        console.error(`   Port ${PORT} is already in use`);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
};

// Wrap in try-catch to catch any unhandled errors
startServer().catch((error) => {
  console.error('❌ Fatal error during server startup:', error.message);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
});
