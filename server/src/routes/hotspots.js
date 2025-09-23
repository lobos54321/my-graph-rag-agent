const express = require('express');
const router = express.Router();

// 热点匹配相关路由
router.get('/trending', (req, res) => {
  // 模拟热点数据
  const mockHotspots = [
    {
      id: 1,
      keyword: 'AI人工智能',
      score: 95,
      trend: 'up',
      category: '科技',
      description: 'AI技术持续火热，相关内容传播效果显著'
    },
    {
      id: 2,
      keyword: '数字化转型',
      score: 88,
      trend: 'stable',
      category: '商业',
      description: '企业数字化转型需求持续增长'
    },
    {
      id: 3,
      keyword: '可持续发展',
      score: 82,
      trend: 'up',
      category: '环保',
      description: '绿色发展理念受到广泛关注'
    }
  ];

  res.json({
    success: true,
    data: mockHotspots
  });
});

router.post('/match', (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({
      success: false,
      message: '内容不能为空'
    });
  }

  // 模拟热点匹配结果
  const matches = [
    {
      keyword: 'AI人工智能',
      relevance: 0.85,
      suggestion: '可以结合AI应用案例增强内容吸引力'
    },
    {
      keyword: '数字化转型',
      relevance: 0.72,
      suggestion: '添加行业转型趋势分析'
    }
  ];

  res.json({
    success: true,
    data: {
      matches,
      totalScore: 78,
      recommendations: [
        '建议增加AI技术应用实例',
        '可以添加行业数据支撑观点',
        '考虑结合时下热点话题'
      ]
    }
  });
});

module.exports = router;