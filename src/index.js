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
    } catch (error) {
      console.log('⚠️  Warning: Could not initialize some database tables');
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
