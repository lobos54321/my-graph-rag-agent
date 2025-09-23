const express = require('express');
const router = express.Router();

// 临时认证路由 - 开发阶段简化实现
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // 简单的开发环境认证
  if (username && password) {
    res.json({
      success: true,
      message: '登录成功',
      token: 'dev-token-' + Date.now(),
      user: {
        id: 1,
        username: username,
        role: 'admin'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: '用户名和密码不能为空'
    });
  }
});

router.post('/register', (req, res) => {
  const { username, password, email } = req.body;
  
  if (username && password && email) {
    res.json({
      success: true,
      message: '注册成功',
      user: {
        id: Date.now(),
        username: username,
        email: email
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: '用户名、密码和邮箱不能为空'
    });
  }
});

router.get('/profile', (req, res) => {
  res.json({
    success: true,
    user: {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    }
  });
});

module.exports = router;