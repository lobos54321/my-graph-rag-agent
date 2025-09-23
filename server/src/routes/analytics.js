const express = require('express');
const router = express.Router();

// 数据分析相关路由
router.get('/dashboard', (req, res) => {
  const dashboardData = {
    totalContent: 156,
    publishedContent: 142,
    totalViews: 89540,
    totalLikes: 3420,
    avgEngagement: 0.68,
    topPerformingContent: [
      {
        title: 'AI技术革命的三大趋势',
        views: 15280,
        likes: 542,
        platform: 'wechat'
      },
      {
        title: '数字化转型成功案例分析',
        views: 12960,
        likes: 389,
        platform: 'xiaohongshu'
      }
    ],
    platformStats: [
      {
        platform: 'wechat',
        posts: 45,
        views: 35280,
        engagement: 0.72
      },
      {
        platform: 'xiaohongshu',
        posts: 38,
        views: 28960,
        engagement: 0.65
      },
      {
        platform: 'weibo',
        posts: 32,
        views: 18420,
        engagement: 0.58
      }
    ]
  };

  res.json({
    success: true,
    data: dashboardData
  });
});

router.get('/content/:id/stats', (req, res) => {
  const { id } = req.params;
  
  const contentStats = {
    id: parseInt(id),
    title: 'AI技术发展趋势解析',
    publishTime: '2024-01-15 10:30:00',
    viewsOverTime: [
      { date: '2024-01-15', views: 1200 },
      { date: '2024-01-16', views: 3400 },
      { date: '2024-01-17', views: 5600 },
      { date: '2024-01-18', views: 8200 },
      { date: '2024-01-19', views: 12800 },
      { date: '2024-01-20', views: 15280 }
    ],
    demographicData: {
      age: {
        '18-24': 15,
        '25-34': 45,
        '35-44': 30,
        '45+': 10
      },
      gender: {
        male: 58,
        female: 42
      },
      location: {
        '北京': 25,
        '上海': 20,
        '深圳': 18,
        '广州': 15,
        '其他': 22
      }
    }
  };

  res.json({
    success: true,
    data: contentStats
  });
});

router.get('/trends', (req, res) => {
  const trends = {
    weekly: [
      { week: '第1周', content: 12, views: 15420, engagement: 0.65 },
      { week: '第2周', content: 15, views: 18960, engagement: 0.68 },
      { week: '第3周', content: 18, views: 22340, engagement: 0.72 },
      { week: '第4周', content: 14, views: 19850, engagement: 0.70 }
    ],
    monthly: [
      { month: '1月', content: 45, views: 68420, engagement: 0.67 },
      { month: '2月', content: 52, views: 78960, engagement: 0.71 },
      { month: '3月', content: 48, views: 72340, engagement: 0.69 }
    ]
  };

  res.json({
    success: true,
    data: trends
  });
});

module.exports = router;