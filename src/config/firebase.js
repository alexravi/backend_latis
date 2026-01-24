// Firebase Admin SDK configuration
require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseAdmin = null;

const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (firebaseAdmin) {
      return firebaseAdmin;
    }

    // Check if Firebase Admin SDK is already initialized (prevents duplicate initialization error)
    try {
      const existingApps = admin.apps;
      if (existingApps && existingApps.length > 0) {
        firebaseAdmin = existingApps[0];
        console.log('✅ Firebase Admin SDK already initialized (reusing existing instance)');
        return firebaseAdmin;
      }
    } catch (checkError) {
      // If check fails, continue with initialization
    }

    // Priority 1: Check for JSON service account file path
    // Supports both FIREBASE_SERVICE_ACCOUNT_PATH and GOOGLE_APPLICATION_CREDENTIALS (standard Firebase env var)
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (serviceAccountPath) {
      try {
        // Resolve path (supports both absolute and relative paths)
        const resolvedPath = path.isAbsolute(serviceAccountPath) 
          ? serviceAccountPath 
          : path.resolve(process.cwd(), serviceAccountPath);
        
        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
          console.warn(`⚠️  Firebase service account file not found: ${resolvedPath}`);
          console.warn('   Falling back to individual environment variables...');
        } else {
          // Load from JSON file
          const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
          
          firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });

          console.log('✅ Firebase Admin SDK initialized from service account file');
          console.log(`   File: ${resolvedPath}`);
          return firebaseAdmin;
        }
      } catch (fileError) {
        console.warn(`⚠️  Error loading Firebase service account file: ${fileError.message}`);
        console.warn('   Falling back to individual environment variables...');
      }
    }

    // Priority 2: Use individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('⚠️  Firebase Admin SDK not initialized - missing configuration');
      console.warn('   Options:');
      console.warn('   1. Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS to path of JSON file');
      console.warn('   2. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
      return null;
    }

    // Replace escaped newlines in private key (common when storing in .env)
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Initialize Firebase Admin SDK
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
    });

    console.log('✅ Firebase Admin SDK initialized from environment variables');
    return firebaseAdmin;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    return null;
  }
};

// Get Firebase Admin instance
const getFirebaseAdmin = () => {
  if (!firebaseAdmin) {
    return initializeFirebase();
  }
  return firebaseAdmin;
};

// Verify Firebase ID token
const verifyIdToken = async (idToken) => {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error.message);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  verifyIdToken,
};
