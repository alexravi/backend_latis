// Database indexes migration script
// Creates indexes on all foreign keys and frequently queried columns for performance optimization
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Add all database indexes for performance optimization
 * This function is idempotent - it will not fail if indexes already exist
 */
const addIndexes = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    logger.info('Starting database index creation...');

    // Users table indexes
    logger.info('Creating indexes on users table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `);

    // Profiles table indexes
    logger.info('Creating indexes on profiles table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
    `);

    // Posts table indexes
    logger.info('Creating indexes on posts table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(score DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id) WHERE parent_post_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
      CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);
      CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_score_created ON posts(score DESC, created_at DESC);
    `);

    // Comments table indexes
    logger.info('Creating indexes on comments table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_score ON comments(score DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC);
    `);

    // Reactions table indexes
    logger.info('Creating indexes on reactions table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id) WHERE post_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON reactions(comment_id) WHERE comment_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_reactions_user_post ON reactions(user_id, post_id) WHERE post_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_reactions_user_comment ON reactions(user_id, comment_id) WHERE comment_id IS NOT NULL;
    `);

    // Connections table indexes
    logger.info('Creating indexes on connections table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_connections_requester_id ON connections(requester_id);
      CREATE INDEX IF NOT EXISTS idx_connections_addressee_id ON connections(addressee_id);
      CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
      CREATE INDEX IF NOT EXISTS idx_connections_requester_status ON connections(requester_id, status);
      CREATE INDEX IF NOT EXISTS idx_connections_addressee_status ON connections(addressee_id, status);
    `);

    // Follows table indexes
    logger.info('Creating indexes on follows table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
      CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
      CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at DESC);
    `);

    // Blocks table indexes
    logger.info('Creating indexes on blocks table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks(blocked_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_created_at ON blocks(created_at DESC);
    `);

    // Notifications table indexes
    logger.info('Creating indexes on notifications table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_related_post_id ON notifications(related_post_id) WHERE related_post_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_notifications_related_comment_id ON notifications(related_comment_id) WHERE related_comment_id IS NOT NULL;
    `);

    // Job postings table indexes
    logger.info('Creating indexes on job_postings table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_postings_is_active ON job_postings(is_active);
      CREATE INDEX IF NOT EXISTS idx_job_postings_specialty ON job_postings(specialty);
      CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON job_postings(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_job_postings_organization_id ON job_postings(organization_id) WHERE organization_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_job_postings_active_created ON job_postings(is_active, created_at DESC) WHERE is_active = TRUE;
    `);

    // Job applications table indexes
    logger.info('Creating indexes on job_applications table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id ON job_applications(applicant_id);
      CREATE INDEX IF NOT EXISTS idx_job_applications_job_posting_id ON job_applications(job_posting_id);
      CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
      CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at DESC);
    `);

    // Medical experiences table indexes
    logger.info('Creating indexes on medical_experiences table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medical_experiences_user_id ON medical_experiences(user_id);
      CREATE INDEX IF NOT EXISTS idx_medical_experiences_organization_id ON medical_experiences(organization_id) WHERE organization_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_medical_experiences_is_current ON medical_experiences(is_current);
      CREATE INDEX IF NOT EXISTS idx_medical_experiences_start_date ON medical_experiences(start_date DESC);
    `);

    // Medical education table indexes
    logger.info('Creating indexes on medical_education table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medical_education_user_id ON medical_education(user_id);
      CREATE INDEX IF NOT EXISTS idx_medical_education_degree_type ON medical_education(degree_type);
      CREATE INDEX IF NOT EXISTS idx_medical_education_graduation_date ON medical_education(graduation_date DESC);
    `);

    // User skills table indexes
    logger.info('Creating indexes on user_skills table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id);
    `);

    // Medical certifications table indexes
    logger.info('Creating indexes on medical_certifications table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medical_certifications_user_id ON medical_certifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_medical_certifications_status ON medical_certifications(status);
    `);

    // Medical publications table indexes
    logger.info('Creating indexes on medical_publications table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medical_publications_user_id ON medical_publications(user_id);
      CREATE INDEX IF NOT EXISTS idx_medical_publications_publication_date ON medical_publications(publication_date DESC);
    `);

    // Medical projects table indexes
    logger.info('Creating indexes on medical_projects table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medical_projects_user_id ON medical_projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_medical_projects_is_current ON medical_projects(is_current);
    `);

    // Awards table indexes
    logger.info('Creating indexes on awards table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_awards_user_id ON awards(user_id);
      CREATE INDEX IF NOT EXISTS idx_awards_year ON awards(year DESC);
    `);

    // Conversations table indexes
    logger.info('Creating indexes on conversations table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_participant1_id ON conversations(participant1_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_participant2_id ON conversations(participant2_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
    `);

    // Messages table indexes
    logger.info('Creating indexes on messages table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
    `);

    // Medical groups table indexes
    logger.info('Creating indexes on medical_groups table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medical_groups_created_by ON medical_groups(created_by);
      CREATE INDEX IF NOT EXISTS idx_medical_groups_created_at ON medical_groups(created_at DESC);
    `);

    // Group memberships table indexes
    logger.info('Creating indexes on group_memberships table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);
      CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_memberships_status ON group_memberships(status);
    `);

    // Shares table indexes
    logger.info('Creating indexes on shares table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id);
      CREATE INDEX IF NOT EXISTS idx_shares_post_id ON shares(post_id);
      CREATE INDEX IF NOT EXISTS idx_shares_created_at ON shares(created_at DESC);
    `);

    // Hashtags table indexes
    logger.info('Creating indexes on hashtags table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hashtags_name ON hashtags(name);
    `);

    // Post hashtags table indexes
    logger.info('Creating indexes on post_hashtags table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_post_hashtags_post_id ON post_hashtags(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_id ON post_hashtags(hashtag_id);
    `);

    // Activity feed table indexes
    logger.info('Creating indexes on activity_feed table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_feed_user_created ON activity_feed(user_id, created_at DESC);
    `);

    // Saved jobs table indexes
    logger.info('Creating indexes on saved_jobs table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_posting_id ON saved_jobs(job_posting_id);
    `);

    // Recommendations table indexes
    logger.info('Creating indexes on recommendations table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
      CREATE INDEX IF NOT EXISTS idx_recommendations_recommender_id ON recommendations(recommender_id);
    `);

    await client.query('COMMIT');
    logger.info('✅ All database indexes created successfully');
    return { success: true, message: 'All indexes created successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, { context: 'addIndexes' });
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  addIndexes,
};
