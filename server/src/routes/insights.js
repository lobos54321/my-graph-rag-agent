const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const GraphRAGService = require('../services/graphragService');
const { generateInsightCard } = require('../services/aiService');

const graphragService = new GraphRAGService();

// 生成内容洞察（包含知识图谱）
router.post('/generate', async (req, res) => {
  try {
    const { contentId, text, includeGraph = true } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: '文本内容不能为空'
      });
    }

    logger.info(`开始生成洞察，内容长度: ${text.length}`);

    // 并行处理：AI洞察卡片 + 知识图谱 + 图谱分析
    const promises = [];
    
    // AI洞察卡片
    promises.push(generateInsightCard({ 
      extractedText: text, 
      type: 'text',
      metadata: { contentId } 
    }));

    // 知识图谱（如果启用）
    let graphDataPromise = null;
    if (includeGraph) {
      graphDataPromise = graphragService.extractEntitiesAndRelations(text);
      promises.push(graphDataPromise);
    }

    const results = await Promise.all(promises);
    const insightCard = results[0];
    const graphData = includeGraph ? results[1] : null;
    
    // 检查图谱数据质量并提供友好提示
    let qualityWarnings = [];
    if (graphData && graphData.metadata) {
      if (graphData.metadata.error === 'text_too_short') {
        qualityWarnings.push({
          type: 'text_length',
          message: '文本内容较短，建议提供更多内容以获得更准确的分析结果',
          suggestion: '尝试输入至少50-100字的完整内容'
        });
      }
      
      if (graphData.metadata.error === 'low_quality_text') {
        qualityWarnings.push({
          type: 'text_quality',
          message: '文本内容重复度较高，可能影响分析质量',
          suggestion: '请提供更加丰富和多样化的内容文本'
        });
      }
      
      if (graphData.nodes.length === 0 && !graphData.metadata.error) {
        qualityWarnings.push({
          type: 'no_entities',
          message: '未能从文本中提取到有效的实体信息',
          suggestion: '尝试提供包含更多具体概念、工具或专业术语的内容'
        });
      }
    }

    // 并行运行图谱分析（如果有图谱数据）
    let graphAnalysis = null;
    if (graphData && graphData.nodes.length > 0) {
      // Run graph analysis in parallel with response preparation for better performance
      const graphAnalysisPromise = graphragService.analyzeGraph(graphData);
      graphAnalysis = await graphAnalysisPromise;
    }

    // Format graph data for HTML frontend compatibility
    let formattedGraphData = graphData;
    if (graphData && graphData.links) {
      formattedGraphData = {
        ...graphData,
        edges: graphData.links // HTML frontend expects 'edges' not 'links'
      };
    }

    const response = {
      success: true,
      data: {
        contentId: contentId || `insight_${Date.now()}`,
        insightCard,
        graphData: formattedGraphData,
        graphAnalysis,
        generatedAt: new Date().toISOString()
      },
      message: '洞察生成完成'
    };

    logger.info(`洞察生成成功: ${insightCard ? '✓' : '✗'}AI卡片, ${graphData ? '✓' : '✗'}知识图谱`);
    res.json(response);

  } catch (error) {
    logger.error('生成洞察失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '洞察生成失败',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 获取历史洞察
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    
    // TODO: 从数据库获取历史洞察记录
    const mockHistory = {
      items: [
        {
          id: 'insight_1',
          title: '营销策略分析',
          contentType: 'text',
          createdAt: '2024-01-15T10:30:00Z',
          insights: {
            viralScore: 8.5,
            targetAudience: '年轻消费者',
            keyTopics: ['社交媒体', '品牌营销', '用户体验']
          }
        },
        {
          id: 'insight_2',
          title: '产品需求文档分析',
          contentType: 'file',
          createdAt: '2024-01-14T15:20:00Z',
          insights: {
            viralScore: 6.2,
            targetAudience: '产品经理',
            keyTopics: ['需求分析', '用户故事', '功能设计']
          }
        }
      ],
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total: 2
      }
    };

    res.json({
      success: true,
      data: mockHistory
    });
  } catch (error) {
    logger.error('获取历史洞察失败:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败'
    });
  }
});

// 获取单个洞察详情
router.get('/:insightId', async (req, res) => {
  try {
    const { insightId } = req.params;
    
    // TODO: 从数据库获取洞察详情
    const mockInsight = {
      id: insightId,
      title: '内容分析洞察',
      contentType: 'text',
      insightCard: {
        corePoints: {
          main: '社交媒体营销的核心是建立真实的用户连接',
          angle: '从情感共鸣角度分析用户行为'
        },
        viralElements: {
          emotionalTrigger: '焦虑+希望',
          cognitiveDisruption: '传统营销思维颠覆',
          identityAlignment: '追求真实的品牌',
          actionDriver: '立即优化营销策略'
        },
        viralPrediction: {
          viralScore: 8.5,
          targetAudience: '25-35岁营销从业者',
          bestChannel: '知乎+LinkedIn',
          riskFactor: '可能引起传统派反对'
        },
        optimizationSuggestions: [
          '增加具体案例支撑',
          '提供可操作的步骤指南',
          '加强数据论证'
        ]
      },
      graphData: {
        nodes: [
          { id: 'entity_1', name: '社交媒体', type: 'concept', category: 'marketing' },
          { id: 'entity_2', name: '用户连接', type: 'concept', category: 'relationship' },
          { id: 'entity_3', name: '情感共鸣', type: 'concept', category: 'psychology' }
        ],
        links: [
          { source: 'entity_1', target: 'entity_2', type: 'enables', weight: 1 },
          { source: 'entity_2', target: 'entity_3', type: 'requires', weight: 0.8 }
        ]
      },
      createdAt: '2024-01-15T10:30:00Z'
    };

    res.json({
      success: true,
      data: mockInsight
    });
  } catch (error) {
    logger.error('获取洞察详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取洞察详情失败'
    });
  }
});

// 更新洞察
router.put('/:insightId', async (req, res) => {
  try {
    const { insightId } = req.params;
    const { title, notes, tags } = req.body;
    
    // TODO: 更新数据库中的洞察记录
    
    logger.info(`洞察更新成功: ${insightId}`);
    
    res.json({
      success: true,
      message: '洞察更新成功'
    });
  } catch (error) {
    logger.error('更新洞察失败:', error);
    res.status(500).json({
      success: false,
      message: '更新失败'
    });
  }
});

// 删除洞察
router.delete('/:insightId', async (req, res) => {
  try {
    const { insightId } = req.params;
    
    // TODO: 从数据库删除洞察记录
    
    logger.info(`洞察删除成功: ${insightId}`);
    
    res.json({
      success: true,
      message: '洞察删除成功'
    });
  } catch (error) {
    logger.error('删除洞察失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败'
    });
  }
});

// 批量生成洞察（用于周报功能）
router.post('/batch-generate', async (req, res) => {
  try {
    const { contentIds, timeRange } = req.body;
    
    if (!contentIds || contentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要分析的内容ID列表'
      });
    }

    logger.info(`开始批量生成洞察，内容数量: ${contentIds.length}`);

    // TODO: 从数据库获取内容列表
    const contents = []; // 模拟获取内容

    // 批量生成洞察
    const batchResults = [];
    for (const contentId of contentIds) {
      try {
        // 模拟内容获取和分析
        const mockContent = {
          id: contentId,
          text: '这是模拟的内容文本用于演示批量分析功能...',
          metadata: { source: 'batch_analysis' }
        };

        const insight = await generateInsightCard(mockContent);
        batchResults.push({
          contentId,
          success: true,
          insight
        });

        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`批量分析失败 - 内容ID: ${contentId}`, error);
        batchResults.push({
          contentId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = batchResults.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: {
        results: batchResults,
        summary: {
          total: contentIds.length,
          success: successCount,
          failed: contentIds.length - successCount
        }
      },
      message: `批量分析完成：${successCount}/${contentIds.length} 成功`
    });

  } catch (error) {
    logger.error('批量生成洞察失败:', error);
    res.status(500).json({
      success: false,
      message: '批量分析失败'
    });
  }
});

// 导出洞察报告
router.post('/export', async (req, res) => {
  try {
    const { insightIds, format = 'json' } = req.body;
    
    if (!insightIds || insightIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要导出的洞察'
      });
    }

    // TODO: 实现导出功能
    const exportData = {
      exportedAt: new Date().toISOString(),
      insights: [], // 从数据库获取洞察数据
      format,
      metadata: {
        version: '1.0',
        generator: 'intelligent-content-workflow'
      }
    };

    res.setHeader('Content-Disposition', `attachment; filename=insights_export_${Date.now()}.${format}`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    
    res.json(exportData);
  } catch (error) {
    logger.error('导出洞察失败:', error);
    res.status(500).json({
      success: false,
      message: '导出失败'
    });
  }
});

module.exports = router;