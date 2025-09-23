const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();
const logger = require('../utils/logger');

// 文件上传配置 (从content.js复制)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'text/html',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'video/mp4',
      'video/avi',
      'video/quicktime'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  }
});

// 引入content.js中的所有函数
const contentRoutes = require('./content');

// 健康检查端点
router.get('/health', async (req, res) => {
  try {
    res.json({
      status: "success",
      message: "GraphRAG service is healthy",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('GraphRAG健康检查失败:', error);
    res.status(500).json({
      status: "error",
      message: "GraphRAG service is unhealthy"
    });
  }
});

// 分析端点 - 直接代理到content路由的graphrag/analyze
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    // 将请求转发到content路由处理
    // 这里我们直接复制content.js中的处理逻辑
    console.log('📄 接收到GraphRAG分析请求');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    const file = req.file;
    const filename = file.originalname;
    console.log(`📄 处理文件: ${filename}`);

    // 读取文件内容
    const fileContent = await fs.readFile(file.path, 'utf8');
    
    // 导入并使用content.js中的处理函数
    const contentHandler = require('./content');
    
    // 调用content路由中的处理逻辑
    // 这里我们需要手动调用处理函数
    
    // 为了简化，我们直接发送请求到content端点
    const FormData = require('form-data');
    const axios = require('axios');
    
    const form = new FormData();
    form.append('file', await fs.readFile(file.path), {
      filename: filename,
      contentType: file.mimetype
    });
    
    const response = await axios.post('http://127.0.0.1:8000/api/graphrag/analyze', form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    
    // 清理临时文件
    await fs.unlink(file.path);
    
    return res.json(response.data);
    
  } catch (error) {
    console.error('GraphRAG分析失败:', error);
    
    // 清理临时文件
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('临时文件清理失败:', unlinkError);
      }
    }
    
    res.status(500).json({
      status: "error",
      message: '分析失败',
      error: error.message
    });
  }
});

module.exports = router;