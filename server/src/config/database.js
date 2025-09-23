const { Pool } = require('pg');
const redis = require('redis');
const logger = require('../utils/logger');

// PostgreSQL连接配置
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis连接配置
let redisClient;

async function connectDB() {
  try {
    // 在开发环境下，如果没有配置数据库URL，跳过数据库连接
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'postgresql://localhost:5432/intelligent_content_db') {
      logger.warn('⚠️ 数据库未配置，跳过PostgreSQL连接（开发模式）');
      return null;
    }
    
    // 测试PostgreSQL连接
    const client = await pgPool.connect();
    logger.info('✅ PostgreSQL连接成功');
    
    // 创建必要的表
    await initializeTables(client);
    client.release();
    
    return pgPool;
  } catch (error) {
    logger.error('❌ PostgreSQL连接失败:', error);
    if (process.env.NODE_ENV === 'development') {
      logger.warn('开发环境下继续运行，数据将使用内存存储');
      return null;
    }
    throw error;
  }
}

async function connectRedis() {
  try {
    // 在开发环境下，如果没有配置Redis URL，跳过Redis连接
    if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://localhost:6379') {
      logger.warn('⚠️ Redis未配置，跳过Redis连接（开发模式）');
      return null;
    }
    
    redisClient = redis.createClient({
      url: process.env.REDIS_URL
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis连接错误:', err);
    });
    
    redisClient.on('connect', () => {
      logger.info('✅ Redis连接成功');
    });
    
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('❌ Redis连接失败:', error);
    if (process.env.NODE_ENV === 'development') {
      logger.warn('开发环境下继续运行，缓存功能将被禁用');
      return null;
    }
    throw error;
  }
}

async function initializeTables(client) {
  const tables = [
    // 用户表
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 内容表
    `CREATE TABLE IF NOT EXISTS contents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      content_type VARCHAR(50) NOT NULL,
      original_content TEXT,
      extracted_text TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 洞察卡片表
    `CREATE TABLE IF NOT EXISTS insight_cards (
      id SERIAL PRIMARY KEY,
      content_id INTEGER REFERENCES contents(id),
      card_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 知识库表
    `CREATE TABLE IF NOT EXISTS knowledge_base (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      content TEXT,
      tags TEXT[],
      parent_id INTEGER REFERENCES knowledge_base(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 热点表
    `CREATE TABLE IF NOT EXISTS hotspots (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      hot_score INTEGER DEFAULT 0,
      tags TEXT[],
      url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 发布记录表
    `CREATE TABLE IF NOT EXISTS publish_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      content_id INTEGER REFERENCES contents(id),
      platform VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      published_at TIMESTAMP,
      external_id VARCHAR(255),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  
  for (const table of tables) {
    try {
      await client.query(table);
      logger.info('数据表创建/检查完成');
    } catch (error) {
      logger.error('创建数据表失败:', error);
      throw error;
    }
  }
}

// 获取数据库连接
function getDB() {
  return pgPool;
}

// 获取Redis连接
function getRedis() {
  return redisClient;
}

// 关闭连接
async function closeConnections() {
  try {
    await pgPool.end();
    if (redisClient) {
      await redisClient.quit();
    }
    logger.info('数据库连接已关闭');
  } catch (error) {
    logger.error('关闭数据库连接失败:', error);
  }
}

module.exports = {
  connectDB,
  connectRedis,
  getDB,
  getRedis,
  closeConnections
};