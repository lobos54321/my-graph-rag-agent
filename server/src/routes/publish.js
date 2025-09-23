const express = require('express');
const router = express.Router();

// 发布相关路由
router.get('/platforms', (req, res) => {
  const platforms = [
    {
      id: 'wechat',
      name: '微信公众号',
      status: 'connected',
      icon: 'wechat'
    },
    {
      id: 'weibo',
      name: '新浪微博',
      status: 'disconnected',
      icon: 'weibo'
    },
    {
      id: 'xiaohongshu',
      name: '小红书',
      status: 'connected',
      icon: 'xiaohongshu'
    },
    {
      id: 'douyin',
      name: '抖音',
      status: 'disconnected',
      icon: 'douyin'
    }
  ];

  res.json({
    success: true,
    data: platforms
  });
});

router.post('/content', (req, res) => {
  const { title, content, platforms, publishTime } = req.body;

  if (!title || !content || !platforms || platforms.length === 0) {
    return res.status(400).json({
      success: false,
      message: '标题、内容和发布平台不能为空'
    });
  }

  // 模拟发布结果
  const results = platforms.map(platform => ({
    platform,
    status: Math.random() > 0.2 ? 'success' : 'failed',
    message: Math.random() > 0.2 ? '发布成功' : '发布失败，请检查平台连接',
    url: `https://${platform}.example.com/post/123456`
  }));

  res.json({
    success: true,
    data: {
      publishId: Date.now(),
      results,
      scheduledTime: publishTime
    }
  });
});

router.get('/history', (req, res) => {
  const history = [
    {
      id: 1,
      title: 'AI技术发展趋势解析',
      publishTime: '2024-01-15 10:30:00',
      platforms: ['wechat', 'weibo'],
      status: 'published',
      views: 15280,
      likes: 342
    },
    {
      id: 2,
      title: '数字化转型实践指南',
      publishTime: '2024-01-14 14:20:00',
      platforms: ['xiaohongshu'],
      status: 'published',
      views: 8960,
      likes: 156
    }
  ];

  res.json({
    success: true,
    data: history
  });
});

module.exports = router;