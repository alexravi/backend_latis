// Status controller - Health check and system status
const { testConnection: testRedisConnection, redisClient } = require('../config/redis');
const { pool } = require('../config/database');
const os = require('os');

// Get Redis connection status
const getRedisStatus = async (req, res) => {
  try {
    const redisStatus = await testRedisConnection();
    
    res.status(200).json({
      success: true,
      data: {
        connected: redisStatus.success,
        enabled: !!process.env.REDIS_HOST,
        message: redisStatus.success ? 'Redis connected' : (redisStatus.error || 'Redis not available'),
        config: process.env.REDIS_HOST ? {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT || 6379,
          db: process.env.REDIS_DB || 0,
          password_set: !!process.env.REDIS_PASSWORD,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get Redis status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error checking Redis status',
      error: error.message,
    });
  }
};

// Get system health status (database, Redis, WebSocket)
const getHealthStatus = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connection with detailed metrics
    let dbStatus;
    let dbQueryTime = null;
    try {
      const queryStart = Date.now();
      const dbResult = await pool.query('SELECT NOW() as timestamp, version() as version');
      dbQueryTime = Date.now() - queryStart;
      
      let versionString = '';
      if (dbResult.rows[0] && dbResult.rows[0].version) {
        const tokens = dbResult.rows[0].version.split(' ');
        versionString = tokens.length >= 2 
          ? tokens.slice(0, 2).join(' ') 
          : dbResult.rows[0].version;
      }
      
      // Get connection pool stats
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      };
      
      dbStatus = {
        connected: true,
        timestamp: dbResult.rows[0].timestamp,
        version: versionString,
        queryTime: `${dbQueryTime}ms`,
        pool: poolStats,
      };
    } catch (error) {
      dbStatus = {
        connected: false,
        error: error.message,
        queryTime: null,
      };
    }

    // Test Redis connection with detailed metrics
    let redisStatus;
    let redisLatency = null;
    try {
      if (process.env.REDIS_HOST && redisClient) {
        const redisStart = Date.now();
        const pingResult = await redisClient.ping();
        redisLatency = Date.now() - redisStart;
        
        // Get Redis info
        let redisInfo = {};
        try {
          const info = await redisClient.info('memory');
          const memoryMatch = info.match(/used_memory:(\d+)/);
          if (memoryMatch) {
            redisInfo.memoryUsed = `${(parseInt(memoryMatch[1]) / 1024 / 1024).toFixed(2)} MB`;
          }
        } catch (infoError) {
          // Ignore info errors
        }
        
        redisStatus = {
          connected: pingResult === 'PONG',
          enabled: true,
          latency: `${redisLatency}ms`,
          ...redisInfo,
        };
      } else {
        redisStatus = {
          connected: false,
          enabled: false,
          message: 'Redis not configured',
        };
      }
    } catch (error) {
      redisStatus = {
        connected: false,
        enabled: !!process.env.REDIS_HOST,
        error: error.message,
      };
    }

    // WebSocket status
    const wsEnabled = process.env.WS_ENABLED !== 'false';
    const wsStatus = {
      enabled: wsEnabled,
      message: wsEnabled ? 'WebSocket enabled' : 'WebSocket disabled',
    };

    // Application metrics
    const memUsage = process.memoryUsage();
    const appMetrics = {
      uptime: `${Math.floor(process.uptime())}s`,
      memory: {
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`,
      },
      cpu: {
        loadAverage: os.loadavg(),
        cpus: os.cpus().length,
      },
    };

    const overallHealth = dbStatus.connected && (redisStatus.connected || !process.env.REDIS_HOST);
    const totalCheckTime = Date.now() - startTime;

    res.status(overallHealth ? 200 : 503).json({
      success: overallHealth,
      data: {
        status: overallHealth ? 'healthy' : 'degraded',
        checkTime: `${totalCheckTime}ms`,
        database: dbStatus,
        redis: redisStatus,
        websocket: wsStatus,
        application: appMetrics,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get health status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error checking system health',
      error: error.message,
    });
  }
};

module.exports = {
  getRedisStatus,
  getHealthStatus,
};
