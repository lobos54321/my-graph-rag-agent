const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDB, connectRedis } = require('./config/database');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // 开发环境允许的origin
    const allowedOrigins = [
      'http://localhost:8000',
      'http://localhost:3000', 
      'http://localhost:8080',
      null // file:// 协议
    ];
    
    if (process.env.NODE_ENV === 'production') {
      // 生产环境只允许配置的FRONTEND_URL
      if (origin === process.env.FRONTEND_URL) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // 开发环境允许localhost、file://和null origin
      if (!origin || origin === 'null' || allowedOrigins.includes(origin) || origin.startsWith('http://localhost')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

// 限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 路由配置
app.use('/api/auth', require('./routes/auth'));
app.use('/api/content', require('./routes/content'));
app.use('/api/graphrag', require('./routes/graphrag'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/hotspots', require('./routes/hotspots'));
app.use('/api/publish', require('./routes/publish'));
app.use('/api/analytics', require('./routes/analytics'));

// Socket.IO连接处理
io.on('connection', (socket) => {
  logger.info(`用户连接: ${socket.id}`);
  
  socket.on('join_room', (room) => {
    socket.join(room);
    logger.info(`用户 ${socket.id} 加入房间: ${room}`);
  });

  socket.on('disconnect', () => {
    logger.info(`用户断开连接: ${socket.id}`);
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 启动服务器
const PORT = process.env.SERVER_PORT || 3001;

async function startServer() {
  try {
    // 连接数据库
    await connectDB();
    await connectRedis();
    
    server.listen(PORT, () => {
      logger.info(`🚀 服务器启动成功，端口: ${PORT}`);
      logger.info(`📋 环境: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

module.exports = { app, io };