const OpenAI = require('openai');
const logger = require('../utils/logger');

// 初始化OpenAI客户端
let openai = null;
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } else {
    logger.warn('OpenAI API密钥未配置，将使用模拟数据');
  }
} catch (error) {
  logger.error('OpenAI客户端初始化失败:', error);
}

/**
 * 生成洞察卡片
 */
async function generateInsightCard(processedContent) {
  try {
    const { extractedText, type, metadata } = processedContent;
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('提取的文本内容为空');
    }
    
    logger.info(`开始生成洞察卡片，内容类型: ${type}, 文本长度: ${extractedText.length}`);
    
    // 构建AI提示词
    const prompt = buildInsightPrompt(extractedText, type);
    
    let aiResponse;
    
    // 如果OpenAI客户端可用，调用API；否则使用模拟数据
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system", 
            content: "你是一个专业的内容分析师，擅长从内容中提取洞察并预测传播潜力。请严格按照JSON格式返回分析结果。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500 // Reduced from 2000 to improve response time
      });
      
      aiResponse = response.choices[0].message.content;
      logger.info('AI分析完成');
    } else {
      // 使用模拟数据
      aiResponse = createMockAIResponse(extractedText);
      logger.info('使用模拟AI分析结果');
    }
    
    // 解析AI响应
    let insightData;
    try {
      // 清理AI响应，提取JSON部分
      const cleanResponse = cleanAIResponse(aiResponse);
      insightData = JSON.parse(cleanResponse);
    } catch (parseError) {
      logger.error('AI响应解析失败:', parseError);
      // 如果JSON解析失败，返回一个基础的结构
      insightData = createFallbackInsight(extractedText);
    }
    
    // 补充基础分析数据
    const enhancedInsight = {
      ...insightData,
      contentId: `content_${Date.now()}`,
      keywords: processedContent.analysis?.keywords || extractBasicKeywords(extractedText),
      readingTime: processedContent.analysis?.readingTime || Math.ceil(extractedText.length / 200),
      metadata: {
        ...metadata,
        generatedAt: new Date().toISOString(),
        model: 'gpt-4',
        textLength: extractedText.length
      }
    };
    
    return enhancedInsight;
    
  } catch (error) {
    logger.error('生成洞察卡片失败:', error);
    
    // 返回错误状态的卡片
    return createErrorInsight(error.message, processedContent);
  }
}

/**
 * 构建洞察分析提示词
 */
function buildInsightPrompt(text, contentType) {
  const basePrompt = `
请深度分析以下内容，并按照JSON格式返回洞察卡片：

内容类型：${contentType}
内容文本：
${text.substring(0, 3000)}...

请按以下JSON结构返回分析结果：
{
  "corePoints": {
    "main": "核心论点（一句话概括）",
    "angle": "独特切入角度"
  },
  "viralElements": {
    "emotionalTrigger": "情绪触发点",
    "cognitiveDisruption": "认知颠覆点", 
    "identityAlignment": "身份认同点",
    "actionDriver": "行动驱动力"
  },
  "argumentStructure": {
    "type": "论证结构类型",
    "strength": "逻辑强项",
    "weakness": "逻辑弱点"
  },
  "viralPrediction": {
    "viralScore": 8.5,
    "targetAudience": "目标受众描述",
    "bestChannel": "最佳传播渠道",
    "riskFactor": "潜在风险因素"
  },
  "optimizationSuggestions": [
    "优化建议1",
    "优化建议2", 
    "优化建议3"
  ]
}

注意：
1. viralScore为1-10的数值，代表传播潜力
2. 所有字段都必须填写
3. 分析要深入且具体，避免泛泛而谈
4. 建议要actionable和具体
`;

  return basePrompt;
}

/**
 * 创建备用洞察（当AI分析失败时）
 */
function createFallbackInsight(text) {
  const basicKeywords = extractBasicKeywords(text);
  
  return {
    corePoints: {
      main: "内容核心观点识别中...",
      angle: "基于文本长度和关键词的基础分析"
    },
    viralElements: {
      emotionalTrigger: "分析中",
      cognitiveDisruption: "分析中",
      identityAlignment: "分析中", 
      actionDriver: "分析中"
    },
    argumentStructure: {
      type: "结构分析中",
      strength: "逻辑分析中",
      weakness: "待深度分析"
    },
    viralPrediction: {
      viralScore: 5,
      targetAudience: "通用受众",
      bestChannel: "多渠道发布",
      riskFactor: "需要进一步分析"
    },
    optimizationSuggestions: [
      "建议使用更强的AI模型进行深度分析",
      "可以尝试分段分析以提高准确性",
      "补充更多上下文信息"
    ]
  };
}

/**
 * 创建错误状态洞察
 */
function createErrorInsight(errorMessage, processedContent) {
  return {
    corePoints: {
      main: "内容分析遇到技术问题",
      angle: "系统错误处理"
    },
    viralElements: {
      emotionalTrigger: "技术故障",
      cognitiveDisruption: "服务中断", 
      identityAlignment: "用户体验",
      actionDriver: "重新尝试"
    },
    argumentStructure: {
      type: "错误处理",
      strength: "系统稳定性机制",
      weakness: errorMessage
    },
    viralPrediction: {
      viralScore: 0,
      targetAudience: "系统用户",
      bestChannel: "错误反馈渠道",
      riskFactor: "服务不可用"
    },
    optimizationSuggestions: [
      "检查API密钥配置",
      "确认网络连接正常",
      "联系技术支持"
    ],
    keywords: processedContent.analysis?.keywords || [],
    readingTime: 1,
    error: true,
    errorMessage
  };
}

/**
 * 清理AI响应，提取JSON部分
 */
function cleanAIResponse(response) {
  // 如果响应已经是有效的JSON，直接返回
  try {
    JSON.parse(response);
    return response;
  } catch (e) {
    // 继续清理
  }

  // 移除可能的前缀文本（如"由于..."）
  let cleaned = response;
  
  // 查找第一个 { 和最后一个 }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  // 移除常见的非JSON前缀
  const prefixPatterns = [
    /^由于[^{]*/,
    /^根据[^{]*/,
    /^基于[^{]*/,
    /^分析[^{]*/
  ];
  
  prefixPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  return cleaned.trim();
}

/**
 * 基础关键词提取
 */
function extractBasicKeywords(text) {
  const words = text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 1);
  
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

/**
 * 创建模拟AI响应
 */
function createMockAIResponse(text) {
  const keywords = extractBasicKeywords(text);
  const contentLength = text.length;
  const score = Math.min(10, Math.max(3, Math.floor(contentLength / 100) + Math.random() * 3));
  
  return JSON.stringify({
    corePoints: {
      main: keywords.length > 0 ? `围绕"${keywords[0].word}"的深入分析` : "内容核心观点分析",
      angle: contentLength > 500 ? "深度解读视角" : "简洁观点阐述"
    },
    viralElements: {
      emotionalTrigger: "引发思考与共鸣",
      cognitiveDisruption: "提供新的认知框架",
      identityAlignment: "符合目标用户认知",
      actionDriver: "启发行动思考"
    },
    argumentStructure: {
      type: contentLength > 1000 ? "系统性论证" : "观点陈述",
      strength: "逻辑清晰，结构完整",
      weakness: "可增加更多实例支撑"
    },
    viralPrediction: {
      viralScore: score,
      targetAudience: "知识型用户群体",
      bestChannel: contentLength > 800 ? "长文平台（微信公众号）" : "短文平台（微博、小红书）",
      riskFactor: "观点表达需注意平衡性"
    },
    optimizationSuggestions: [
      "可以增加具体案例来支撑观点",
      "建议优化标题吸引力",
      "考虑添加视觉元素提升传播效果"
    ]
  });
}

/**
 * 批量生成洞察（用于周报功能）
 */
async function generateBatchInsights(contentList) {
  try {
    const insights = [];
    
    for (const content of contentList) {
      try {
        const insight = await generateInsightCard(content);
        insights.push(insight);
        
        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`批量分析失败 - 内容ID: ${content.id}`, error);
        insights.push(createErrorInsight(error.message, content));
      }
    }
    
    return insights;
  } catch (error) {
    logger.error('批量洞察生成失败:', error);
    throw error;
  }
}

module.exports = {
  generateInsightCard,
  generateBatchInsights
};