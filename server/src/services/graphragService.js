const axios = require('axios');
const logger = require('../utils/logger');
const { NlpManager } = require('node-nlp');
const GraphStateManager = require('./graphStateManager');
const AdvancedReasoningEngine = require('./advancedReasoningEngine');
const Neo4jGraphService = require('./neo4jService');
const { getDomainConfig, getAvailableDomains, mergeDomainConfigs } = require('../config/domainConfigs');

class GraphRAGService {
  constructor() {
    this.graphragUrl = process.env.GRAPH_RAG_AGENT_URL || 'http://localhost:8001';
    this.nlpManager = new NlpManager({ languages: ['zh'], nlu: { useNoneFeature: false } });
    this.initialized = false;
    
    // 初始化增强服务
    this.stateManager = new GraphStateManager();
    this.reasoningEngine = new AdvancedReasoningEngine();
    this.neo4jService = new Neo4jGraphService();
    
    // 领域配置
    this.currentDomain = 'general'; // 默认通用领域
    this.domainConfig = getDomainConfig(this.currentDomain);
    
    this.initializeServices();
  }

  async initializeNLP() {
    if (this.initialized) return;

    try {
      // 添加实体类型
      this.nlpManager.addNamedEntityText('person', 'person', 'zh', ['人', '专家', '学者', '教授', 'CEO', '创始人']);
      this.nlpManager.addNamedEntityText('organization', 'organization', 'zh', ['公司', '机构', '组织', '团队', '企业']);
      this.nlpManager.addNamedEntityText('concept', 'concept', 'zh', ['概念', '理论', '方法', '策略', '技术', '模式']);
      this.nlpManager.addNamedEntityText('product', 'product', 'zh', ['产品', '服务', '工具', '平台', '系统']);
      
      await this.nlpManager.train();
      this.initialized = true;
      logger.info('NLP Manager初始化完成');
    } catch (error) {
      logger.error('NLP Manager初始化失败:', error);
    }
  }

  /**
   * 设置分析领域
   */
  setDomain(domain) {
    if (typeof domain === 'string') {
      this.currentDomain = domain;
      this.domainConfig = getDomainConfig(domain);
    } else if (Array.isArray(domain)) {
      // 多领域混合
      this.currentDomain = domain.join('+');
      this.domainConfig = mergeDomainConfigs(domain);
    }
    
    logger.info(`切换到分析领域: ${this.domainConfig.name}`);
    return this.domainConfig;
  }

  /**
   * 获取可用领域列表
   */
  getAvailableDomains() {
    return getAvailableDomains();
  }

  /**
   * 获取当前领域配置
   */
  getCurrentDomainConfig() {
    return {
      domain: this.currentDomain,
      config: this.domainConfig
    };
  }

  /**
   * 智能领域检测
   */
  detectDomain(text) {
    const domains = getAvailableDomains();
    const scores = {};
    
    domains.forEach(domain => {
      const config = getDomainConfig(domain.key);
      let score = 0;
      
      // 基于核心术语计算匹配分数
      config.coreTerms.forEach(term => {
        const regex = new RegExp(term, 'gi');
        const matches = (text.match(regex) || []).length;
        score += matches * (config.termWeights[term] || 1);
      });
      
      // 基于工具模式匹配
      config.toolPatterns.forEach(pattern => {
        const matches = (text.match(pattern) || []).length;
        score += matches * 2; // 工具匹配权重较高
      });
      
      scores[domain.key] = score;
    });
    
    // 找到最高分数的领域
    const bestDomain = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)[0];
    
    logger.info(`领域检测结果: ${JSON.stringify(scores)}, 推荐领域: ${bestDomain[0]}`);
    
    return {
      recommendedDomain: bestDomain[0],
      scores,
      confidence: bestDomain[1] / Math.max(1, text.length / 100) // 标准化置信度
    };
  }

  /**
   * 从文本中提取实体和关系（支持多领域配置）
   */
  async extractEntitiesAndRelations(text, options = {}) {
    try {
      // 文本长度验证 - 防止对过短文本进行无意义分析
      if (!text || typeof text !== 'string') {
        throw new Error('输入文本不能为空');
      }
      
      const cleanText = text.trim();
      if (cleanText.length < 20) {
        logger.warn(`文本过短(${cleanText.length}字符)，无法进行有效分析`);
        return {
          nodes: [],
          links: [],
          metadata: {
            domain: this.currentDomain,
            domainConfig: this.domainConfig.name,
            error: 'text_too_short',
            message: '文本内容过短，建议至少20个字符以上才能进行有效的实体关系分析',
            textLength: cleanText.length,
            minLength: 20
          }
        };
      }
      
      // 检查文本质量 - 避免分析无意义的重复内容
      const uniqueChars = new Set(cleanText.toLowerCase()).size;
      const repetitionRatio = uniqueChars / cleanText.length;
      if (repetitionRatio < 0.3 && cleanText.length < 100) {
        logger.warn(`文本重复度过高(${(repetitionRatio * 100).toFixed(1)}%)，可能无法产生有效分析`);
        return {
          nodes: [],
          links: [],
          metadata: {
            domain: this.currentDomain,
            domainConfig: this.domainConfig.name,
            error: 'low_quality_text',
            message: '文本内容重复度过高或质量较低，无法进行有效分析',
            repetitionRatio: repetitionRatio,
            textLength: cleanText.length
          }
        };
      }
      
      // 智能领域检测或使用指定领域
      let targetDomain = options.domain;
      if (!targetDomain && options.autoDetect !== false) {
        const detection = this.detectDomain(cleanText);
        if (detection.confidence > 0.3) {
          targetDomain = detection.recommendedDomain;
          logger.info(`自动检测到领域: ${targetDomain} (置信度: ${(detection.confidence * 100).toFixed(1)}%)`);
        }
      }
      
      // 切换到目标领域（如果检测到）
      if (targetDomain && targetDomain !== this.currentDomain) {
        this.setDomain(targetDomain);
      }
      
      logger.info(`使用${this.domainConfig.name}领域配置进行分析`);
      
      // 1. 使用领域特定的NLP提取命名实体
      const entities = await this.extractNamedEntities(cleanText, options);
      
      // 2. 使用领域特定模式分析文本结构，提取关系
      const relations = await this.extractRelations(cleanText, entities, options);
      
      // 3. 构建图结构
      const graphData = this.buildGraphStructure(entities, relations);
      
      // 4. 添加领域元数据
      graphData.metadata = {
        ...graphData.metadata,
        domain: this.currentDomain,
        domainConfig: this.domainConfig.name,
        detectedDomain: targetDomain,
        analysisMode: options.mode || 'standard',
        textLength: cleanText.length,
        textQuality: repetitionRatio
      };
      
      logger.info(`${this.domainConfig.name}领域实体关系提取完成: ${entities.length}个实体, ${relations.length}个关系`);
      
      return graphData;
    } catch (error) {
      logger.error('实体关系提取失败:', error);
      throw error;
    }
  }

  /**
   * 提取命名实体（支持领域配置）
   */
  async extractNamedEntities(text, options = {}) {
    const entities = [];
    
    try {
      // 使用node-nlp进行实体识别
      const result = await this.nlpManager.process('zh', text);
      
      // 处理识别到的实体
      if (result.entities) {
        result.entities.forEach(entity => {
          entities.push({
            id: `entity_${entities.length}`,
            name: entity.sourceText,
            type: 'entity',
            category: entity.entity,
            weight: entity.accuracy || 1,
            properties: {
              start: entity.start,
              end: entity.end,
              resolution: entity.resolution,
              domain: this.currentDomain
            }
          });
        });
      }

      // 使用领域特定配置补充关键词作为概念实体
      const keywords = this.extractKeywordEntities(text, options);
      entities.push(...keywords);

      // 增强实体质量 - 合并相似实体和添加核心实体
      const enhancedEntities = this.enhanceEntityQuality(entities, text, options);

      return enhancedEntities;
    } catch (error) {
      logger.error('命名实体识别失败:', error);
      return [];
    }
  }

  /**
   * 增强实体质量（支持多领域配置）
   */
  enhanceEntityQuality(entities, text, options = {}) {
    // 1. 去重和合并相似实体
    const deduplicatedEntities = this.deduplicateEntities(entities);
    
    // 2. 识别核心实体（主题词）- 使用领域配置
    const coreEntities = this.identifyCoreEntities(text, deduplicatedEntities, options);
    
    // 3. 添加缺失的重要实体 - 使用领域配置
    const supplementedEntities = this.addMissingImportantEntities(text, deduplicatedEntities, options);
    
    // 4. 计算实体重要性分数 - 使用领域配置
    const scoredEntities = this.calculateEntityImportance(supplementedEntities, text, options);
    
    // 5. 过滤低质量实体
    return this.filterLowQualityEntities(scoredEntities);
  }

  /**
   * 去重相似实体
   */
  deduplicateEntities(entities) {
    const uniqueEntities = [];
    const seen = new Set();
    
    entities.forEach(entity => {
      const key = entity.name.toLowerCase().replace(/\s+/g, '');
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEntities.push(entity);
      } else {
        // 合并到已存在的实体
        const existing = uniqueEntities.find(e => 
          e.name.toLowerCase().replace(/\s+/g, '') === key
        );
        if (existing) {
          existing.weight = Math.max(existing.weight, entity.weight);
          existing.properties = { ...existing.properties, ...entity.properties };
        }
      }
    });
    
    return uniqueEntities;
  }

  /**
   * 识别核心实体（支持多领域配置）
   */
  identifyCoreEntities(text, entities, options = {}) {
    // 使用当前领域配置的核心术语
    const coreKeywords = this.domainConfig.coreTerms || [];
    
    entities.forEach(entity => {
      if (coreKeywords.some(keyword => 
        entity.name.includes(keyword) || keyword.includes(entity.name)
      )) {
        // 使用领域配置的术语权重
        const termWeight = this.domainConfig.termWeights[entity.name] || 3;
        entity.weight = Math.max(entity.weight, termWeight);
        entity.category = 'core_concept';
        entity.properties = { 
          ...entity.properties, 
          is_core: true,
          domain: this.currentDomain,
          term_weight: termWeight
        };
      }
    });
    
    return entities;
  }

  /**
   * 添加缺失的重要实体（支持多领域配置）
   */
  addMissingImportantEntities(text, entities, options = {}) {
    // 使用当前领域配置构建重要术语列表
    const domainCoreTerms = this.domainConfig.coreTerms || [];
    const domainTermWeights = this.domainConfig.termWeights || {};
    
    // 构建领域特定的重要术语
    const importantTerms = domainCoreTerms.map(term => ({
      name: term,
      category: this.getDomainSpecificCategory(term, this.currentDomain),
      weight: domainTermWeights[term] || 2.0
    }));
    
    // 添加通用重要术语（权重较低，避免偏向）
    const universalTerms = [
      { name: '优化', category: 'process', weight: 1.5 },
      { name: '分析', category: 'methodology', weight: 1.5 },
      { name: '系统', category: 'technology', weight: 1.5 },
      { name: '管理', category: 'process', weight: 1.5 }
    ];
    
    const allImportantTerms = [...importantTerms, ...universalTerms];
    
    allImportantTerms.forEach(term => {
      if (text.includes(term.name)) {
        const exists = entities.some(e => e.name === term.name);
        if (!exists) {
          entities.push({
            id: `important_${entities.length}`,
            name: term.name,
            type: 'concept',
            category: term.category,
            weight: term.weight,
            properties: {
              source: 'important_supplement',
              auto_added: true,
              domain: this.currentDomain,
              domain_specific: importantTerms.some(dt => dt.name === term.name)
            }
          });
        }
      }
    });
    
    return entities;
  }

  /**
   * 计算实体重要性分数（支持多领域配置）
   */
  calculateEntityImportance(entities, text, options = {}) {
    const textLength = Math.max(text.length, 1); // 防止除零错误
    const domainTermWeights = this.domainConfig.termWeights || {};
    
    return entities.map(entity => {
      let importance = this.safeNumber(entity.weight, 1);
      
      // 使用领域特定的术语权重加成
      if (domainTermWeights[entity.name]) {
        const termWeight = this.safeNumber(domainTermWeights[entity.name], 1);
        importance += (termWeight - 1) * 0.5;
      }
      
      // 基于出现频率 - 增加安全检查
      try {
        const entityNameRegex = new RegExp(entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const occurrences = (text.match(entityNameRegex) || []).length;
        const frequencyScore = Math.log(Math.max(occurrences, 1)) * 0.5;
        if (this.isValidNumber(frequencyScore)) {
          importance += frequencyScore;
        }
      } catch (regexError) {
        // 正则表达式失败时使用简单计数
        const simpleCount = text.split(entity.name).length - 1;
        const frequencyScore = Math.log(Math.max(simpleCount, 1)) * 0.5;
        if (this.isValidNumber(frequencyScore)) {
          importance += frequencyScore;
        }
      }
      
      // 基于位置（标题和开头更重要）- 防止除零错误
      const firstIndex = text.indexOf(entity.name);
      if (firstIndex !== -1 && textLength > 0) {
        const positionScore = 1 - (firstIndex / textLength);
        if (this.isValidNumber(positionScore)) {
          importance += positionScore * 0.3;
        }
      }
      
      // 基于实体类型（根据领域调整权重）
      const categoryBonus = this.getDomainCategoryBonus(entity.category, entity.type);
      if (this.isValidNumber(categoryBonus)) {
        importance += categoryBonus;
      }
      
      // 领域匹配加成
      if (entity.properties?.domain === this.currentDomain) {
        importance += 0.2;
      }
      
      // 确保最终重要性是有效数值
      const finalImportance = this.safeNumber(importance, 1);
      entity.weight = Math.round(Math.max(0.1, finalImportance) * 10) / 10;
      entity.properties = {
        ...entity.properties,
        calculated_importance: finalImportance,
        domain_bonus: this.safeNumber(domainTermWeights[entity.name], 0),
        category_bonus: this.safeNumber(categoryBonus, 0)
      };
      
      return entity;
    });
  }

  /**
   * 过滤低质量实体
   */
  filterLowQualityEntities(entities) {
    return entities.filter(entity => {
      const name = entity.name.trim();
      
      // 基本长度和权重过滤
      if (entity.weight < 0.5) return false;
      if (name.length < 2) return false;
      if (name.length > 20) return false; // 过长的实体通常是错误提取
      
      // 纯数字、纯字母、纯符号过滤
      if (/^[0-9]+$/.test(name)) return false;
      if (/^[a-zA-Z]$/.test(name)) return false;
      if (/^[^\u4e00-\u9fa5a-zA-Z0-9]+$/.test(name)) return false; // 纯符号
      
      // 无意义的中文片段过滤
      const meaninglessPatterns = [
        /^的.+/, // 以"的"开头的片段
        /^了.+/, // 以"了"开头的片段
        /^和.+/, // 以"和"开头的片段
        /^或.+/, // 以"或"开头的片段
        /^在.+/, // 以"在"开头的片段
        /^与.+/, // 以"与"开头的片段
        /^对.+/, // 以"对"开头的片段
        /^为.+/, // 以"为"开头的片段
        /^从.+/, // 以"从"开头的片段
        /^到.+/, // 以"到"开头的片段
        /^把.+/, // 以"把"开头的片段
        /^让.+/, // 以"让"开头的片段
        /^使.+/, // 以"使"开头的片段
        /^将.+/, // 以"将"开头的片段
        /^会.+/, // 以"会"开头的片段
        /^是.+/, // 以"是"开头的片段
        /^有.+/, // 以"有"开头的片段
        /.*的$/, // 以"的"结尾的片段
        /.*了$/, // 以"了"结尾的片段  
        /.*吗$/, // 以"吗"结尾的片段
        /.*呢$/, // 以"呢"结尾的片段
        /.*吧$/, // 以"吧"结尾的片段
        /.*么$/, // 以"么"结尾的片段
        /^[一二三四五六七八九十]+$/, // 纯数字汉字
        /示例内容|测试内容|样本数据|演示文本/, // 明显的测试内容
        /^[手拼搓融合]+.*/, // 动作类开头的无意义片段
        /^[可能应该或许大概]+.*/, // 推测词开头
        /^[但是然而不过虽然]+.*/, // 连接词开头
        /^[如果假如要是]+.*/, // 假设词开头
      ];
      
      // 检查是否匹配无意义模式
      if (meaninglessPatterns.some(pattern => pattern.test(name))) {
        return false;
      }
      
      // 过滤纯连接词、介词、助词
      const functionalWords = new Set([
        '的', '了', '和', '或', '在', '与', '对', '为', '从', '到', '把', '让', '使', '将', 
        '会', '是', '有', '个', '这', '那', '其', '它', '他', '她', '我', '你', '们',
        '吗', '呢', '吧', '么', '啊', '嗯', '哦', '呀', '哈', '嘿', '喂',
        '但是', '然而', '不过', '虽然', '尽管', '因为', '所以', '如果', '要是',
        '可能', '应该', '或许', '大概', '也许', '估计', '差不多', '左右'
      ]);
      
      if (functionalWords.has(name)) {
        return false;
      }
      
      // 过滤单字符中文（除非是重要术语）
      if (name.length === 1 && /[\u4e00-\u9fa5]/.test(name)) {
        const importantSingleChars = new Set(['AI', 'IT', 'UI', 'UX', 'ROI', 'SEO', 'API', 'CEO', 'CTO', 'CRM', 'ERP']);
        if (!importantSingleChars.has(name.toUpperCase())) {
          return false;
        }
      }
      
      // 过滤明显不完整的词汇片段
      if (name.length <= 3) {
        // 检查是否为有意义的短词
        const meaningfulShortWords = new Set([
          'AI', 'IT', 'UI', 'UX', 'ROI', 'SEO', 'API', 'CEO', 'CTO', 'CRM', 'ERP',
          '营销', '推广', '分析', '数据', '用户', '内容', '品牌', '产品', '服务', 
          '平台', '系统', '工具', '方案', '策略', '模式', '效果', '转化', '流量',
          '优化', '运营', '管理', '设计', '开发', '技术', '创新', '体验', '价值'
        ]);
        
        if (!meaningfulShortWords.has(name)) {
          return false;
        }
      }
      
      // 确保实体包含至少一个有意义的字符（中文、英文或数字）
      if (!/[\u4e00-\u9fa5a-zA-Z0-9]/.test(name)) {
        return false;
      }
      
      return true;
    }).sort((a, b) => b.weight - a.weight);
  }

  /**
   * 提取关键词作为概念实体（支持多领域配置）
   */
  extractKeywordEntities(text, options = {}) {
    const concepts = [];
    
    // 扩展的停用词列表
    const stopWords = new Set([
      // 动词类
      '用于', '使用', '进行', '通过', '实现', '提供', '包括', '具有', '需要', '可以', '应该', '能够',
      '说明', '表示', '展示', '显示', '描述', '介绍', '解释', '说', '讲', '谈', '聊', 
      '做', '搞', '弄', '搭', '建', '创', '造', '制', '产', '生', '发', '出', '来', '去',
      '拿', '拉', '推', '拽', '拖', '抓', '握', '抱', '扔', '丢', '放', '摆', '置',
      '看', '听', '闻', '摸', '感', '觉', '想', '思', '考', '虑', '记', '忆', '忘',
      '手搓', '拼好', '融合', '整合', '合并', '混合', '搭配', '配合', '结合',
      
      // 代词类
      '这个', '那个', '一个', '一些', '哪个', '什么', '如何', '怎么', '怎样', '为什么',
      '这里', '那里', '哪里', '什么地方', '什么时候', '什么人', '什么事',
      '我', '你', '他', '她', '它', '我们', '你们', '他们', '她们', '它们',
      '自己', '别人', '大家', '每个', '所有', '全部', '部分', '一点', '一些',
      
      // 连接词和介词
      '因为', '所以', '但是', '然而', '虽然', '尽管', '即使', '不过', '而且', '并且',
      '根据', '基于', '关于', '对于', '由于', '为了', '以及', '或者', '还是', '不是',
      '在', '从', '到', '向', '朝', '往', '与', '和', '同', '跟', '对', '为', '被',
      '把', '将', '让', '使', '叫', '请', '要', '想', '愿', '肯', '敢', '会', '能',
      
      // 时间词
      '现在', '今天', '明天', '昨天', '以前', '以后', '之前', '之后', '当前', '目前',
      '刚才', '刚刚', '马上', '立即', '立刻', '很快', '慢慢', '一直', '总是', '从来',
      
      // 程度词和修饰词
      '很', '非常', '特别', '极其', '相当', '比较', '更', '最', '太', '挺', '蛮', '超',
      '稍微', '略微', '有点', '一点', '一些', '多少', '几乎', '差不多', '大约', '左右',
      '可能', '或许', '也许', '大概', '估计', '应该', '肯定', '一定', '必须', '当然',
      
      // 无意义的片段词
      '的示例', '示例内容', '测试内容', '样本数据', '演示文本', '示例文本', '测试数据',
      '内容用', '用来', '用以', '用作', '作为', '当作', '看作', '视为', '认为', '觉得',
      '比如', '例如', '譬如', '好比', '就像', '如同', '仿佛', '似乎', '好像', '看起来',
      
      // 标点和符号相关
      '逗号', '句号', '感叹号', '问号', '冒号', '分号', '引号', '括号', '破折号',
      
      // 语气词和感叹词
      '啊', '呀', '哎', '哦', '嗯', '嘿', '哈', '呵', '咦', '咿', '嘘', '喂',
      '吗', '呢', '吧', '么', '嘛', '呀', '哟', '喽', '嘞', '咯', '喔'
    ]);
    
    // 使用当前领域配置的工具模式
    const toolPatterns = this.domainConfig.toolPatterns || [];
    
    // 提取领域特定的工具和专业术语
    toolPatterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const term = match[1] || match[0];
        if (term && term.length > 1 && !stopWords.has(term)) {
          concepts.push({
            id: `tool_${concepts.length}`,
            name: term.trim(),
            type: 'tool',
            category: 'professional_term',
            weight: 2.5, // 专业术语权重更高
            properties: {
              pattern_index: patternIndex,
              position: match.index,
              source: 'domain_specific_extraction',
              domain: this.currentDomain
            }
          });
        }
      }
    });
    
    // 使用当前领域配置的概念模式
    const conceptPatterns = this.domainConfig.conceptPatterns || [];
    
    conceptPatterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const concept = match[1] || match[0];
        if (concept && concept.length > 2 && !stopWords.has(concept)) {
          concepts.push({
            id: `concept_${concepts.length}`,
            name: concept.trim(),
            type: 'concept',
            category: 'domain_concept',
            weight: 2.0,
            properties: {
              pattern_index: patternIndex,
              position: match.index,
              source: 'domain_concept_extraction',
              domain: this.currentDomain
            }
          });
        }
      }
    });
    
    // 基于领域核心术语进行强化识别
    const coreTerms = this.domainConfig.coreTerms || [];
    coreTerms.forEach(term => {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = text.match(regex);
      if (matches) {
        const exists = concepts.some(c => c.name.toLowerCase() === term.toLowerCase());
        if (!exists) {
          concepts.push({
            id: `core_${concepts.length}`,
            name: term,
            type: 'concept',
            category: 'core_concept',
            weight: this.domainConfig.termWeights[term] || 2.0,
            properties: {
              frequency: matches.length,
              source: 'core_term_extraction',
              domain: this.currentDomain,
              is_core: true
            }
          });
        }
      }
    });
    
    // 提取重要的名词短语（2-6个字符的中文词组）
    const nounPhrases = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    const phraseFreq = {};
    
    // 统计词频
    nounPhrases.forEach(phrase => {
      if (!stopWords.has(phrase) && phrase.length >= 2) {
        phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
      }
    });
    
    // 只保留出现频率较高或在领域中重要的词组
    Object.entries(phraseFreq).forEach(([phrase, freq]) => {
      if (freq >= 2 || this.isImportantTerm(phrase)) {
        // 避免重复添加
        const exists = concepts.some(c => c.name === phrase);
        if (!exists) {
          concepts.push({
            id: `phrase_${concepts.length}`,
            name: phrase,
            type: 'entity',
            category: 'key_phrase',
            weight: Math.min(3, freq), // 根据频率设置权重，最高3
            properties: {
              frequency: freq,
              source: 'frequency_extraction',
              domain: this.currentDomain
            }
          });
        }
      }
    });

    return concepts;
  }
  
  /**
   * 判断是否为重要术语（支持多领域配置）
   */
  isImportantTerm(term) {
    // 使用当前领域的核心术语作为重要术语判断依据
    const domainCoreTerms = this.domainConfig.coreTerms || [];
    
    // 通用重要模式（跨领域）
    const universalPatterns = [
      '指标体系', '配置指南', '案例库', '模板', '框架',
      '分析', '优化', '管理', '系统', '平台', '工具'
    ];
    
    // 检查是否匹配领域核心术语
    const matchesDomainTerms = domainCoreTerms.some(coreTerm => 
      term.includes(coreTerm) || coreTerm.includes(term)
    );
    
    // 检查是否匹配通用重要模式
    const matchesUniversalPatterns = universalPatterns.some(pattern => 
      term.includes(pattern)
    );
    
    return matchesDomainTerms || matchesUniversalPatterns;
  }

  /**
   * 提取实体间关系（支持多领域配置）
   */
  async extractRelations(text, entities, options = {}) {
    const relations = [];
    
    try {
      // 使用当前领域配置的关系模式，如果没有则使用默认模式
      const domainRelationPatterns = this.domainConfig.relationPatterns || [];
      
      // 基础关系模式（作为补充）
      const baseRelationPatterns = [
        { pattern: /(.{2,10})(用于|适用于|应用于)(.{2,10})/g, type: 'used_for', weight: 0.8 },
        { pattern: /(.{2,10})(包含|包括|涵盖)(.{2,10})/g, type: 'contains', weight: 0.7 },
        { pattern: /(.{2,10})(基于|依据|根据)(.{2,10})/g, type: 'based_on', weight: 0.7 },
        { pattern: /(.{2,10})(影响|决定|驱动)(.{2,10})/g, type: 'influences', weight: 0.8 },
        { pattern: /(.{2,10})(属于|归类为|分类为)(.{2,10})/g, type: 'belongs_to', weight: 0.6 },
        { pattern: /(.{2,10})(需要|要求|依赖)(.{2,10})/g, type: 'requires', weight: 0.7 },
        { pattern: /(.{2,10})(生成|产生|创建)(.{2,10})/g, type: 'generates', weight: 0.8 },
        { pattern: /(.{2,10})(优化|改进|提升)(.{2,10})/g, type: 'optimizes', weight: 0.9 },
        { pattern: /(.{2,10})(分析|评估|监控)(.{2,10})/g, type: 'analyzes', weight: 0.8 },
        { pattern: /(.{2,10})(集成|整合|连接)(.{2,10})/g, type: 'integrates', weight: 0.7 }
      ];
      
      // 合并领域特定模式和基础模式
      const relationPatterns = [...domainRelationPatterns, ...baseRelationPatterns];

      relationPatterns.forEach((relPattern, patternIndex) => {
        let match;
        while ((match = relPattern.pattern.exec(text)) !== null) {
          const subject = match[1]?.trim();
          const object = match[2]?.trim();

          if (subject && object) {
            // 尝试匹配到实体
            const subjectEntity = this.findMatchingEntity(subject, entities);
            const objectEntity = this.findMatchingEntity(object, entities);

            if (subjectEntity && objectEntity) {
              relations.push({
                source: subjectEntity.id,
                target: objectEntity.id,
                type: relPattern.type,
                weight: 1,
                properties: {
                  pattern_index: patternIndex,
                  original_text: match[0],
                  confidence: 0.7
                }
              });
            }
          }
        }
      });

      // 基于共现的关系推断
      const cooccurrenceRelations = this.extractCooccurrenceRelations(entities, text);
      relations.push(...cooccurrenceRelations);

      // 增强关系质量
      const enhancedRelations = this.enhanceRelationQuality(relations, entities, text);

      return enhancedRelations;
    } catch (error) {
      logger.error('关系提取失败:', error);
      return [];
    }
  }

  /**
   * 基于共现提取关系（改进版）
   */
  extractCooccurrenceRelations(entities, text) {
    const relations = [];
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    
    // 基于句子级别的共现分析
    sentences.forEach(sentence => {
      const entitiesInSentence = [];
      
      // 找到在同一句话中出现的实体
      entities.forEach(entity => {
        if (sentence.includes(entity.name)) {
          entitiesInSentence.push(entity);
        }
      });
      
      // 为同一句话中的实体创建关系
      for (let i = 0; i < entitiesInSentence.length; i++) {
        for (let j = i + 1; j < entitiesInSentence.length; j++) {
          const entity1 = entitiesInSentence[i];
          const entity2 = entitiesInSentence[j];
          
          // 避免低价值的关系（如两个都是工具类型）
          if (this.shouldCreateRelation(entity1, entity2, sentence)) {
            const existingRelation = relations.find(r => 
              (r.source === entity1.id && r.target === entity2.id) ||
              (r.source === entity2.id && r.target === entity1.id)
            );
            
            if (existingRelation) {
              // 增加现有关系的权重
              existingRelation.weight += 0.3;
              existingRelation.properties.cooccurrence_count += 1;
            } else {
              // 创建新关系
              relations.push({
                source: entity1.id,
                target: entity2.id,
                type: this.determineRelationType(entity1, entity2, sentence),
                weight: this.calculateRelationWeight(entity1, entity2, sentence),
                properties: {
                  context: sentence.trim().substring(0, 100),
                  method: 'sentence_cooccurrence',
                  cooccurrence_count: 1
                }
              });
            }
          }
        }
      }
    });

    return relations.filter(r => r.weight > 0.3); // 只保留高质量关系
  }
  
  /**
   * 判断是否应该创建关系
   */
  shouldCreateRelation(entity1, entity2, context) {
    // 避免创建无意义的关系
    const meaninglessTypes = ['entity', 'key_phrase'];
    if (meaninglessTypes.includes(entity1.type) && meaninglessTypes.includes(entity2.type)) {
      return false;
    }
    
    // 实体名称太短或太相似时不创建关系
    if (entity1.name.length < 2 || entity2.name.length < 2) {
      return false;
    }
    
    if (entity1.name.includes(entity2.name) || entity2.name.includes(entity1.name)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 确定关系类型
   */
  determineRelationType(entity1, entity2, context) {
    // 基于实体类型确定关系
    if (entity1.type === 'tool' && entity2.type === 'concept') {
      return 'tool_for_concept';
    }
    
    if (entity1.category === 'professional_term' || entity2.category === 'professional_term') {
      return 'professional_related';
    }
    
    // 基于上下文关键词确定关系
    if (context.includes('用于') || context.includes('应用')) {
      return 'used_for';
    }
    
    if (context.includes('包含') || context.includes('包括')) {
      return 'contains';
    }
    
    return 'related_to';
  }
  
  /**
   * 计算关系权重
   */
  calculateRelationWeight(entity1, entity2, context) {
    let weight = 0.5; // 基础权重
    
    // 专业术语权重更高
    if (entity1.category === 'professional_term' || entity2.category === 'professional_term') {
      weight += 0.3;
    }
    
    // 工具类实体权重更高
    if (entity1.type === 'tool' || entity2.type === 'tool') {
      weight += 0.2;
    }
    
    // 上下文中有明确关系词时权重更高
    const relationKeywords = ['用于', '基于', '包含', '优化', '分析', '应用于'];
    if (relationKeywords.some(keyword => context.includes(keyword))) {
      weight += 0.3;
    }
    
    return Math.min(1.0, weight); // 最大权重为1.0
  }

  /**
   * 查找匹配的实体
   */
  findMatchingEntity(text, entities) {
    // 精确匹配
    let match = entities.find(entity => entity.name === text);
    if (match) return match;

    // 部分匹配
    match = entities.find(entity => 
      entity.name.includes(text) || text.includes(entity.name)
    );
    if (match) return match;

    // 语义相似度匹配（简化版）
    match = entities.find(entity => {
      const similarity = this.calculateStringSimilarity(entity.name, text);
      return similarity > 0.7;
    });

    return match || null;
  }

  /**
   * 计算字符串相似度
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 计算编辑距离
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 构建图结构
   */
  buildGraphStructure(entities, relations) {
    return {
      nodes: entities.map(entity => ({
        ...entity,
        x: Math.random() * 800,
        y: Math.random() * 600
      })),
      links: relations,
      metadata: {
        nodeCount: entities.length,
        linkCount: relations.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 真正的GraphRAG图谱分析 (增强版)
   */
  async analyzeGraph(graphData, graphId = 'default', textContent = '') {
    try {
      // 首先存储图谱数据到Neo4j（如果可用）
      if (this.neo4jService && this.neo4jService.isConnected) {
        await this.neo4jService.storeGraphData(graphData, graphId);
      }

      const analysis = {
        // 1. 增强的中心性分析 - 使用Neo4j高级算法
        centrality: await this.enhancedCentralityAnalysis(graphData, graphId),
        
        // 2. 增强的社区检测 - 使用专业算法
        communities: await this.enhancedCommunityDetection(graphData, graphId),
        
        // 3. 增强的路径分析 - 多跳推理
        pathAnalysis: await this.enhancedPathAnalysis(graphData, textContent),
        
        // 4. 因果关系分析 - 新功能
        causalAnalysis: await this.analyzeCausalRelationships(graphData, textContent),
        
        // 5. Hidden Patterns Discovery - 隐藏模式发现
        hiddenPatterns: await this.discoverHiddenPatterns(graphData, textContent),
        
        // 6. 知识缺口检测 - 保持现有功能
        knowledgeGaps: this.detectKnowledgeGaps(graphData),
        
        // 7. 跨文档连接发现 - 保持现有功能
        crossDocConnections: this.findCrossDocumentConnections(graphData),
        
        // 8. 关键洞察生成 - 增强版
        insights: this.generateGraphInsights(graphData),
        
        // 9. 图谱统计信息
        statistics: this.neo4jService && this.neo4jService.isConnected 
          ? await this.neo4jService.getGraphStatistics(graphId)
          : this.calculateBasicStatistics(graphData)
      };

      logger.info(`增强GraphRAG分析完成: ${Object.keys(analysis).length}个分析维度`);
      return analysis;
    } catch (error) {
      logger.error('增强图谱分析失败:', error);
      
      // 降级到基础分析
      logger.info('降级到基础GraphRAG分析...');
      return {
        centrality: this.calculateCentrality(graphData),
        communities: this.detectSemanticCommunities(graphData),
        pathAnalysis: this.analyzeConceptPaths(graphData),
        knowledgeGaps: this.detectKnowledgeGaps(graphData),
        crossDocConnections: this.findCrossDocumentConnections(graphData),
        insights: this.generateGraphInsights(graphData),
        statistics: this.calculateBasicStatistics(graphData)
      };
    }
  }
  
  /**
   * 语义社区检测（改进版）
   */
  detectSemanticCommunities(graphData) {
    const communities = [];
    const visited = new Set();
    const { nodes, links } = graphData;
    
    // 按实体类型和权重构建邻接表
    const adjacencyList = this.buildSemanticAdjacencyList(nodes, links);
    
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const community = this.semanticDFS(node.id, adjacencyList, visited, nodes);
        if (community.length >= 2) {
          // 计算社区的语义一致性
          const semanticScore = this.calculateSemanticCoherence(community, links);
          const mainTheme = this.identifyMainTheme(community);
          
          communities.push({
            id: `community_${communities.length}`,
            theme: mainTheme,
            members: community,
            semanticScore: semanticScore,
            size: community.length,
            centralNode: this.findCommunityCenter(community, links)
          });
        }
      }
    });
    
    // 按语义分数排序
    return communities.sort((a, b) => b.semanticScore - a.semanticScore);
  }
  
  /**
   * 构建语义邻接表
   */
  buildSemanticAdjacencyList(nodes, links) {
    const adjacencyList = {};
    
    // 初始化邻接表
    nodes.forEach(node => {
      adjacencyList[node.id] = [];
    });
    
    // 添加边，只保留高质量的语义连接
    links.forEach(link => {
      if (link.weight > 0.3) {
        adjacencyList[link.source].push({
          target: link.target,
          weight: link.weight,
          type: link.type
        });
        adjacencyList[link.target].push({
          target: link.source,
          weight: link.weight,
          type: link.type
        });
      }
    });
    
    return adjacencyList;
  }
  
  /**
   * 语义深度优先搜索
   */
  semanticDFS(nodeId, adjacencyList, visited, allNodes) {
    const community = [];
    const stack = [nodeId];
    
    while (stack.length > 0) {
      const currentId = stack.pop();
      
      if (visited.has(currentId)) continue;
      
      visited.add(currentId);
      const node = allNodes.find(n => n.id === currentId);
      if (node) community.push(node);
      
      // 找到语义相关的邻居节点
      const neighbors = adjacencyList[currentId] || [];
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor.target) && neighbor.weight > 0.4) {
          stack.push(neighbor.target);
        }
      });
    }
    
    return community;
  }
  
  /**
   * 计算语义一致性
   */
  calculateSemanticCoherence(community, links) {
    let totalWeight = 0;
    let connectionCount = 0;
    
    // 计算社区内部连接的平均权重
    for (let i = 0; i < community.length; i++) {
      for (let j = i + 1; j < community.length; j++) {
        const link = links.find(l => 
          (l.source === community[i].id && l.target === community[j].id) ||
          (l.source === community[j].id && l.target === community[i].id)
        );
        
        if (link) {
          totalWeight += link.weight;
          connectionCount++;
        }
      }
    }
    
    const avgWeight = connectionCount > 0 ? totalWeight / connectionCount : 0;
    
    // 考虑实体类型的一致性
    const typeDistribution = {};
    community.forEach(node => {
      const category = node.category || node.type;
      typeDistribution[category] = (typeDistribution[category] || 0) + 1;
    });
    
    const dominantTypeRatio = Math.max(...Object.values(typeDistribution)) / community.length;
    
    return (avgWeight * 0.6 + dominantTypeRatio * 0.4);
  }
  
  /**
   * 识别主题
   */
  identifyMainTheme(community) {
    // 基于实体类型和名称识别主题
    const themes = {};
    
    community.forEach(node => {
      const category = node.category || 'general';
      if (!themes[category]) {
        themes[category] = {
          count: 0,
          entities: [],
          totalWeight: 0
        };
      }
      themes[category].count++;
      themes[category].entities.push(node.name);
      themes[category].totalWeight += node.weight || 1;
    });
    
    // 找到权重最高的主题
    const sortedThemes = Object.entries(themes)
      .sort(([,a], [,b]) => b.totalWeight - a.totalWeight);
    
    if (sortedThemes.length > 0) {
      const [themeCategory, themeData] = sortedThemes[0];
      const topEntities = themeData.entities.slice(0, 3).join('、');
      
      switch (themeCategory) {
        case 'professional_term':
          return `专业工具集群: ${topEntities}`;
        case 'business_concept':
          return `业务概念体系: ${topEntities}`;
        case 'key_phrase':
          return `核心概念: ${topEntities}`;
        default:
          return `${themeCategory}相关: ${topEntities}`;
      }
    }
    
    return '混合主题集群';
  }
  
  /**
   * 找到社区中心节点
   */
  findCommunityCenter(community, links) {
    let maxConnections = -1;
    let centerNode = null;
    
    community.forEach(node => {
      const connections = links.filter(link => 
        (link.source === node.id || link.target === node.id) &&
        community.some(c => c.id === link.source || c.id === link.target)
      ).length;
      
      if (connections > maxConnections) {
        maxConnections = connections;
        centerNode = node;
      }
    });
    
    return centerNode;
  }
  
  /**
   * 概念路径分析 - GraphRAG的核心功能
   */
  analyzeConceptPaths(graphData) {
    const paths = [];
    const { nodes, links } = graphData;
    
    // 找到高价值节点作为起点
    const keyNodes = nodes.filter(n => 
      n.type === 'tool' || n.category === 'professional_term' || n.weight > 1.5
    );
    
    keyNodes.forEach(startNode => {
      keyNodes.forEach(endNode => {
        if (startNode.id !== endNode.id) {
          const path = this.findShortestSemanticPath(startNode, endNode, links, nodes);
          if (path && path.length > 2 && path.length <= 4) {
            const pathInsight = this.generatePathInsight(path, nodes);
            paths.push({
              start: startNode.name,
              end: endNode.name,
              path: path.map(nodeId => nodes.find(n => n.id === nodeId)?.name),
              pathLength: path.length,
              insight: pathInsight,
              confidence: this.calculatePathConfidence(path, links)
            });
          }
        }
      });
    });
    
    return paths
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // 返回top 5路径
  }
  
  /**
   * 找到最短语义路径
   */
  findShortestSemanticPath(startNode, endNode, links, nodes) {
    const queue = [[startNode.id]];
    const visited = new Set([startNode.id]);
    
    while (queue.length > 0) {
      const currentPath = queue.shift();
      const currentNodeId = currentPath[currentPath.length - 1];
      
      if (currentNodeId === endNode.id) {
        return currentPath;
      }
      
      if (currentPath.length >= 5) continue; // 限制最大路径长度
      
      // 找到相邻节点
      const neighbors = links.filter(link => 
        (link.source === currentNodeId || link.target === currentNodeId) &&
        link.weight > 0.3
      );
      
      neighbors.forEach(link => {
        const nextNodeId = link.source === currentNodeId ? link.target : link.source;
        
        if (!visited.has(nextNodeId)) {
          visited.add(nextNodeId);
          queue.push([...currentPath, nextNodeId]);
        }
      });
    }
    
    return null;
  }
  
  /**
   * 生成路径洞察
   */
  generatePathInsight(path, nodes) {
    const pathNodes = path.map(nodeId => nodes.find(n => n.id === nodeId)).filter(n => n);
    
    if (pathNodes.length < 3) return '路径过短，无法生成洞察';
    
    const start = pathNodes[0];
    const middle = pathNodes.slice(1, -1);
    const end = pathNodes[pathNodes.length - 1];
    
    // 根据节点类型生成不同的洞察
    if (start.type === 'tool' && end.type === 'concept') {
      const bridgeTerms = middle.map(n => n.name).join('→');
      return `通过 ${start.name} 工具，经由 ${bridgeTerms} 可以实现 ${end.name}。这种路径揭示了工具与概念之间的实践联系。`;
    }
    
    if (start.category === 'professional_term' && end.category === 'professional_term') {
      const bridgeTerms = middle.map(n => n.name).join('→');
      return `${start.name} 与 ${end.name} 通过 ${bridgeTerms} 建立了专业关联。这反映了营销领域的知识连接模式。`;
    }
    
    const pathDescription = pathNodes.map(n => n.name).join(' → ');
    return `发现概念链：${pathDescription}。这种连接模式可能代表了一个完整的业务流程或知识体系。`;
  }
  
  /**
   * 计算路径置信度
   */
  calculatePathConfidence(path, links) {
    let totalWeight = 0;
    let linkCount = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const link = links.find(l => 
        (l.source === path[i] && l.target === path[i + 1]) ||
        (l.source === path[i + 1] && l.target === path[i])
      );
      
      if (link) {
        totalWeight += link.weight;
        linkCount++;
      }
    }
    
    const avgWeight = linkCount > 0 ? totalWeight / linkCount : 0;
    const pathLengthPenalty = 1 / Math.max(1, path.length - 2); // 路径越长置信度越低
    
    return avgWeight * pathLengthPenalty;
  }
  
  /**
   * 知识缺口检测
   */
  detectKnowledgeGaps(graphData) {
    const gaps = [];
    const { nodes, links } = graphData;
    
    // 1. 找到孤立或连接度很低的重要节点
    const isolatedImportantNodes = nodes.filter(node => {
      const connections = links.filter(link => 
        link.source === node.id || link.target === node.id
      ).length;
      return connections <= 1 && (node.weight > 1 || node.type === 'tool');
    });
    
    isolatedImportantNodes.forEach(node => {
      gaps.push({
        type: 'isolated_concept',
        concept: node.name,
        description: `"${node.name}" 是重要概念但缺乏与其他概念的连接`,
        suggestion: `建议创建内容解释 ${node.name} 与其他营销概念的关系`,
        priority: 'high'
      });
    });
    
    // 2. 检测应该存在但缺失的连接
    const expectedConnections = this.detectMissingConnections(nodes, links);
    expectedConnections.forEach(connection => {
      gaps.push({
        type: 'missing_connection',
        concept1: connection.from,
        concept2: connection.to,
        description: `${connection.from} 和 ${connection.to} 之间可能存在重要关联但当前缺失`,
        suggestion: connection.suggestion,
        priority: connection.priority
      });
    });
    
    return gaps;
  }
  
  /**
   * 检测缺失的连接
   */
  detectMissingConnections(nodes, links) {
    const expectedConnections = [];
    const existingConnections = new Set();
    
    // 构建现有连接的集合
    links.forEach(link => {
      existingConnections.add(`${link.source}-${link.target}`);
      existingConnections.add(`${link.target}-${link.source}`);
    });
    
    // 定义应该存在的连接模式
    const connectionPatterns = [
      {
        condition: (n1, n2) => n1.type === 'tool' && n2.category === 'business_concept',
        suggestion: '工具与业务概念应该有应用关系',
        priority: 'high'
      },
      {
        condition: (n1, n2) => 
          n1.category === 'professional_term' && n2.category === 'professional_term' &&
          (n1.name.includes('分析') && n2.name.includes('优化') ||
           n1.name.includes('用户') && n2.name.includes('体验')),
        suggestion: '相关专业术语应该建立语义连接',
        priority: 'medium'
      },
      {
        condition: (n1, n2) => 
          (n1.name.includes('Google Analytics') && n2.name.includes('数据')) ||
          (n1.name.includes('LinkedIn') && n2.name.includes('营销')),
        suggestion: '工具与其核心应用场景应该连接',
        priority: 'high'
      }
    ];
    
    // 检查每对节点
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        const connectionKey = `${node1.id}-${node2.id}`;
        
        if (!existingConnections.has(connectionKey)) {
          // 检查是否应该存在连接
          connectionPatterns.forEach(pattern => {
            if (pattern.condition(node1, node2)) {
              expectedConnections.push({
                from: node1.name,
                to: node2.name,
                suggestion: pattern.suggestion,
                priority: pattern.priority,
                reason: '基于语义相似性和业务逻辑'
              });
            }
          });
        }
      }
    }
    
    return expectedConnections.slice(0, 5); // 返回前5个最重要的缺失连接
  }
  
  /**
   * 跨文档连接发现
   */
  findCrossDocumentConnections(graphData) {
    const connections = [];
    const { nodes, links } = graphData;
    
    // 按文档来源分组节点
    const documentGroups = {};
    nodes.forEach(node => {
      const docSource = node.properties?.document || 'unknown';
      if (!documentGroups[docSource]) {
        documentGroups[docSource] = [];
      }
      documentGroups[docSource].push(node);
    });
    
    // 找到连接不同文档的关系
    links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode) {
        const sourceDoc = sourceNode.properties?.document || 'unknown';
        const targetDoc = targetNode.properties?.document || 'unknown';
        
        if (sourceDoc !== targetDoc && sourceDoc !== 'unknown' && targetDoc !== 'unknown') {
          connections.push({
            concept1: sourceNode.name,
            concept2: targetNode.name,
            document1: sourceDoc,
            document2: targetDoc,
            relationshipType: link.type,
            insight: `发现 "${sourceDoc}" 中的 ${sourceNode.name} 与 "${targetDoc}" 中的 ${targetNode.name} 存在 ${link.type} 关系`
          });
        }
      }
    });
    
    return connections;
  }
  
  /**
   * 生成真正的图谱洞察
   */
  generateGraphInsights(graphData) {
    const insights = [];
    const { nodes, links } = graphData;
    
    // 1. 核心概念识别
    const centralNodes = this.calculateCentrality(graphData).topNodes.slice(0, 3);
    if (centralNodes.length > 0) {
      insights.push({
        type: 'central_concepts',
        title: '核心概念体系',
        description: `您的知识体系围绕 ${centralNodes.map(([,node]) => node.name).join('、')} 等核心概念构建`,
        actionable: '建议深化这些核心概念的内容，它们是您内容体系的支柱'
      });
    }
    
    // 2. 知识密度分析
    const toolNodes = nodes.filter(n => n.type === 'tool').length;
    const conceptNodes = nodes.filter(n => n.type === 'concept').length;
    const ratio = toolNodes / (conceptNodes || 1);
    
    if (ratio > 0.5) {
      insights.push({
        type: 'tool_heavy',
        title: '工具导向的知识结构',
        description: `您的内容偏重实用工具 (${toolNodes}个工具 vs ${conceptNodes}个概念)`,
        actionable: '考虑增加理论概念内容，平衡实用性和深度'
      });
    } else {
      insights.push({
        type: 'concept_rich',
        title: '概念丰富的知识体系',
        description: `您有丰富的概念框架 (${conceptNodes}个概念 vs ${toolNodes}个工具)`,
        actionable: '可以增加更多实用工具和案例来支撑理论概念'
      });
    }
    
    // 3. 连接模式分析
    const avgConnections = (links.length * 2) / nodes.length;
    if (avgConnections < 2) {
      insights.push({
        type: 'sparse_connections',
        title: '知识点连接稀疏',
        description: '平均每个概念只有' + avgConnections.toFixed(1) + '个连接',
        actionable: '建议创建更多内容来连接孤立的概念，形成知识网络'
      });
    }
    
    return insights;
  }

  /**
   * 计算中心性
   */
  calculateCentrality(graphData) {
    const { nodes, links } = graphData;
    const centrality = {};

    // 度中心性
    nodes.forEach(node => {
      const degree = links.filter(link => 
        link.source === node.id || link.target === node.id
      ).length;
      
      centrality[node.id] = {
        degree,
        name: node.name,
        type: node.type
      };
    });

    // 按度排序
    const sortedNodes = Object.entries(centrality)
      .sort(([,a], [,b]) => b.degree - a.degree)
      .slice(0, 10);

    return {
      topNodes: sortedNodes,
      avgDegree: Object.values(centrality).reduce((sum, node) => sum + node.degree, 0) / nodes.length
    };
  }

  /**
   * 社区检测（简化版）
   */
  detectCommunities(graphData) {
    // 简化的社区检测算法
    const communities = [];
    const visited = new Set();

    graphData.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const community = this.dfsCluster(node.id, graphData, visited);
        if (community.length > 1) {
          communities.push(community);
        }
      }
    });

    return communities.slice(0, 5); // 返回前5个最大的社区
  }

  /**
   * DFS聚类
   */
  dfsCluster(nodeId, graphData, visited) {
    const cluster = [];
    const stack = [nodeId];

    while (stack.length > 0) {
      const currentId = stack.pop();
      
      if (visited.has(currentId)) continue;
      
      visited.add(currentId);
      const node = graphData.nodes.find(n => n.id === currentId);
      if (node) cluster.push(node);

      // 找到相邻节点
      graphData.links.forEach(link => {
        if (link.source === currentId && !visited.has(link.target)) {
          stack.push(link.target);
        } else if (link.target === currentId && !visited.has(link.source)) {
          stack.push(link.source);
        }
      });
    }

    return cluster;
  }

  /**
   * 生成洞察
   */
  generateInsights(graphData) {
    const insights = [];
    
    // 节点类型分布
    const typeDistribution = {};
    graphData.nodes.forEach(node => {
      typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
    });

    insights.push({
      type: 'distribution',
      title: '实体类型分布',
      data: typeDistribution
    });

    // 关系类型分析
    const relationTypes = {};
    graphData.links.forEach(link => {
      relationTypes[link.type] = (relationTypes[link.type] || 0) + 1;
    });

    insights.push({
      type: 'relations',
      title: '关系类型分析',
      data: relationTypes
    });

    // 密度分析
    const nodeCount = graphData.nodes.length;
    const linkCount = graphData.links.length;
    const maxLinks = nodeCount * (nodeCount - 1) / 2;
    const density = linkCount / maxLinks;

    insights.push({
      type: 'density',
      title: '图密度分析',
      value: density,
      description: density > 0.5 ? '高密度连接' : density > 0.2 ? '中等密度连接' : '稀疏连接'
    });

    return insights;
  }

  /**
   * 增强的中心性分析
   */
  async enhancedCentralityAnalysis(graphData, graphId) {
    // 如果Neo4j可用，使用更高级的中心性算法
    if (this.neo4jService && this.neo4jService.isConnected) {
      try {
        const [degreeResults, betweennessResults, pageRankResults] = await Promise.all([
          this.neo4jService.calculateCentrality(graphId, 'degree'),
          this.neo4jService.calculateCentrality(graphId, 'betweenness'),
          this.neo4jService.calculateCentrality(graphId, 'pagerank')
        ]);

        return {
          degree: degreeResults,
          betweenness: betweennessResults,
          pageRank: pageRankResults,
          topNodes: degreeResults.slice(0, 10).map(r => [r.node.id, r.node]),
          avgDegree: degreeResults.reduce((sum, r) => sum + r.centrality, 0) / degreeResults.length
        };
      } catch (error) {
        logger.warn('Neo4j中心性分析失败，使用基础算法:', error);
      }
    }

    // 降级到基础算法
    return this.calculateCentrality(graphData);
  }

  /**
   * 增强的社区检测
   */
  async enhancedCommunityDetection(graphData, graphId) {
    // 如果Neo4j可用，使用专业的社区检测算法
    if (this.neo4jService && this.neo4jService.isConnected) {
      try {
        const neo4jCommunities = await this.neo4jService.detectCommunities(graphId, 'louvain');
        
        if (neo4jCommunities.length > 0) {
          return neo4jCommunities.map((community, index) => ({
            id: `neo4j_community_${index}`,
            theme: this.identifyMainTheme(community.members),
            members: community.members,
            semanticScore: this.calculateSemanticCoherence(community.members, graphData.links),
            size: community.size,
            centralNode: this.findCommunityCenter(community.members, graphData.links),
            algorithm: 'neo4j_louvain'
          }));
        }
      } catch (error) {
        logger.warn('Neo4j社区检测失败，使用基础算法:', error);
      }
    }

    // 降级到基础算法
    return this.detectSemanticCommunities(graphData);
  }

  /**
   * 增强的路径分析
   */
  async enhancedPathAnalysis(graphData, textContent) {
    const results = [];
    
    // 基础路径分析
    const basicPaths = this.analyzeConceptPaths(graphData);
    results.push(...basicPaths);

    // 使用高级推理引擎进行多跳推理
    try {
      const { nodes } = graphData;
      const keyNodes = nodes.filter(n => n.weight > 1.5 || n.type === 'tool');
      
      for (let i = 0; i < Math.min(keyNodes.length, 3); i++) {
        for (let j = i + 1; j < Math.min(keyNodes.length, 3); j++) {
          const multiHopPaths = await this.reasoningEngine.findMultiHopPaths(
            graphData, 
            keyNodes[i].id, 
            keyNodes[j].id, 
            4
          );
          
          results.push(...multiHopPaths.map(path => ({
            start: keyNodes[i].name,
            end: keyNodes[j].name,
            path: path.pathNames,
            pathLength: path.path.length,
            insight: path.reasoning,
            confidence: path.confidence,
            algorithm: 'advanced_reasoning'
          })));
        }
      }
    } catch (error) {
      logger.warn('高级路径分析失败:', error);
    }

    return results.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
  }

  /**
   * 因果关系分析
   */
  async analyzeCausalRelationships(graphData, textContent = '') {
    try {
      const causalAnalysis = await this.reasoningEngine.buildCausalChains(graphData, textContent);
      
      return {
        causalRelations: causalAnalysis.causalRelations.slice(0, 5),
        causalChains: causalAnalysis.causalChains.slice(0, 3),
        insights: causalAnalysis.insights
      };
    } catch (error) {
      logger.warn('因果关系分析失败:', error);
      return {
        causalRelations: [],
        causalChains: [],
        insights: []
      };
    }
  }

  /**
   * Hidden Patterns Discovery - 隐藏模式发现
   */
  async discoverHiddenPatterns(graphData, textContent = '') {
    try {
      const patterns = {
        // 1. 多跳路径发现 - 寻找非显性连接
        multiHopPaths: [],
        
        // 2. 反向推理分析 - 从结果推原因
        reverseInferences: [],
        
        // 3. 类比推理 - 结构相似性分析
        analogicalPatterns: [],
        
        // 4. 结构异常检测
        structuralAnomalies: [],
        
        // 5. 隐含关系挖掘
        implicitRelations: []
      };

      const { nodes, links } = graphData;

      // 多跳路径发现 - 寻找长距离连接
      if (nodes.length >= 3) {
        const importantNodes = nodes
          .sort((a, b) => (b.weight || 1) - (a.weight || 1))
          .slice(0, 5);

        for (let i = 0; i < importantNodes.length; i++) {
          for (let j = i + 1; j < importantNodes.length; j++) {
            const paths = await this.reasoningEngine.findMultiHopPaths(
              graphData, 
              importantNodes[i].id, 
              importantNodes[j].id, 
              4
            );
            
            patterns.multiHopPaths.push(...paths.slice(0, 2));
          }
        }
      }

      // 反向推理分析 - 对关键结果节点进行原因分析
      const effectNodes = nodes.filter(n => 
        n.category === 'result' || 
        n.category === 'outcome' ||
        n.type === 'effect' ||
        (n.weight || 1) > 2
      ).slice(0, 3);

      for (const effectNode of effectNodes) {
        try {
          const reverseAnalysis = await this.reasoningEngine.reverseReasoning(
            graphData, 
            effectNode.id, 
            3
          );
          patterns.reverseInferences.push(reverseAnalysis);
        } catch (err) {
          logger.warn(`反向推理失败 ${effectNode.id}:`, err.message);
        }
      }

      // 类比推理 - 寻找结构相似的实体
      const sourcePatterns = nodes.filter(n => n.category && (n.weight || 1) > 1).slice(0, 3);
      const targetDomains = [...new Set(nodes.map(n => n.category).filter(c => c))];

      for (const sourcePattern of sourcePatterns) {
        for (const targetDomain of targetDomains.slice(0, 2)) {
          if (sourcePattern.category !== targetDomain) {
            try {
              const analogies = await this.reasoningEngine.analogicalReasoning(
                graphData, 
                sourcePattern, 
                targetDomain
              );
              patterns.analogicalPatterns.push(...analogies.slice(0, 2));
            } catch (err) {
              logger.warn(`类比推理失败:`, err.message);
            }
          }
        }
      }

      // 结构异常检测 - 寻找度数异常的节点
      const degreeMap = new Map();
      links.forEach(link => {
        degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
        degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
      });

      const avgDegree = Array.from(degreeMap.values()).reduce((a, b) => a + b, 0) / degreeMap.size;
      const anomalies = nodes.filter(node => {
        const degree = degreeMap.get(node.id) || 0;
        return degree > avgDegree * 2 || (degree === 0 && (node.weight || 1) > 1);
      });

      patterns.structuralAnomalies = anomalies.map(node => ({
        node: node,
        anomalyType: degreeMap.get(node.id) > avgDegree * 2 ? 'high_connectivity' : 'isolated_important',
        degree: degreeMap.get(node.id) || 0,
        avgDegree: avgDegree,
        reasoning: degreeMap.get(node.id) > avgDegree * 2 
          ? '该节点连接数异常高，可能是关键枢纽'
          : '该节点重要但孤立，可能存在缺失连接'
      }));

      // 隐含关系挖掘 - 基于共同邻居推断
      const implicitRelations = [];
      nodes.forEach(nodeA => {
        nodes.forEach(nodeB => {
          if (nodeA.id !== nodeB.id) {
            const commonNeighbors = this.findCommonNeighbors(nodeA.id, nodeB.id, links);
            if (commonNeighbors.length >= 2 && !this.hasDirectConnection(nodeA.id, nodeB.id, links)) {
              implicitRelations.push({
                source: nodeA,
                target: nodeB,
                commonNeighbors: commonNeighbors,
                implicitStrength: commonNeighbors.length,
                reasoning: `通过${commonNeighbors.length}个共同邻居暗示潜在关系`
              });
            }
          }
        });
      });

      patterns.implicitRelations = implicitRelations
        .sort((a, b) => b.implicitStrength - a.implicitStrength)
        .slice(0, 5);

      logger.info(`隐藏模式发现完成: ${patterns.multiHopPaths.length}条多跳路径, ${patterns.reverseInferences.length}个反向推理, ${patterns.analogicalPatterns.length}个类比模式`);
      
      return patterns;

    } catch (error) {
      logger.warn('隐藏模式发现失败:', error);
      return {
        multiHopPaths: [],
        reverseInferences: [],
        analogicalPatterns: [],
        structuralAnomalies: [],
        implicitRelations: []
      };
    }
  }

  /**
   * 寻找共同邻居
   */
  findCommonNeighbors(nodeA, nodeB, links) {
    const neighborsA = new Set();
    const neighborsB = new Set();
    
    links.forEach(link => {
      if (link.source === nodeA) neighborsA.add(link.target);
      if (link.target === nodeA) neighborsA.add(link.source);
      if (link.source === nodeB) neighborsB.add(link.target);
      if (link.target === nodeB) neighborsB.add(link.source);
    });
    
    return [...neighborsA].filter(neighbor => neighborsB.has(neighbor));
  }

  /**
   * 检查直接连接
   */
  hasDirectConnection(nodeA, nodeB, links) {
    return links.some(link => 
      (link.source === nodeA && link.target === nodeB) ||
      (link.source === nodeB && link.target === nodeA)
    );
  }

  /**
   * 动态图谱更新
   */
  async updateGraph(newContent, existingGraphId = null) {
    try {
      // 提取新内容的实体和关系
      const newGraphData = await this.extractEntitiesAndRelations(newContent);
      
      let updatedGraph;
      
      if (existingGraphId && this.neo4jService && this.neo4jService.isConnected) {
        // 从Neo4j获取现有图谱
        const existingStats = await this.neo4jService.getGraphStatistics(existingGraphId);
        
        if (existingStats && existingStats.nodeCount > 0) {
          // 执行增量更新
          const delta = await this.stateManager.calculateGraphDelta(newGraphData, null);
          updatedGraph = await this.stateManager.applyDelta(newGraphData, delta);
          
          // 存储更新后的图谱
          await this.neo4jService.storeGraphData(updatedGraph, existingGraphId);
        } else {
          // 首次创建
          updatedGraph = newGraphData;
          await this.neo4jService.storeGraphData(updatedGraph, existingGraphId);
        }
      } else {
        // 内存模式
        updatedGraph = newGraphData;
      }
      
      logger.info(`图谱更新完成: ${updatedGraph.nodes.length}个节点, ${updatedGraph.links.length}个关系`);
      return updatedGraph;
      
    } catch (error) {
      logger.error('动态图谱更新失败:', error);
      throw error;
    }
  }

  /**
   * 获取变更历史
   */
  getGraphHistory() {
    return this.stateManager.getChangeHistory();
  }

  /**
   * 获取领域特定的类别
   */
  getDomainSpecificCategory(term, domain) {
    const categoryMap = {
      'marketing': {
        '内容营销': 'marketing_strategy',
        '用户画像': 'user_analysis',
        'ROI': 'performance_metric',
        '转化率': 'performance_metric'
      },
      'technology': {
        '性能优化': 'optimization',
        '系统架构': 'architecture',
        '微服务': 'architecture_pattern',
        '云计算': 'infrastructure'
      },
      'business': {
        '商业模式': 'business_strategy',
        '战略规划': 'strategic_planning',
        '运营效率': 'operational_metric',
        '数字化转型': 'transformation'
      },
      'education': {
        '学习体验': 'learning_design',
        '知识图谱': 'knowledge_structure',
        '个性化学习': 'learning_method',
        '学习分析': 'learning_analytics'
      }
    };
    
    return categoryMap[domain]?.[term] || 'domain_concept';
  }
  
  /**
   * 获取领域类别权重加成
   */
  getDomainCategoryBonus(category, type) {
    // 基础类型权重
    let bonus = 0;
    
    if (category === 'core_concept') bonus += 1;
    if (category === 'professional_term') bonus += 0.5;
    if (type === 'tool') bonus += 0.3;
    
    // 领域特定权重加成
    const domainSpecificCategories = {
      'marketing': ['marketing_strategy', 'user_analysis', 'performance_metric'],
      'technology': ['optimization', 'architecture', 'architecture_pattern', 'infrastructure'],
      'business': ['business_strategy', 'strategic_planning', 'operational_metric', 'transformation'],
      'education': ['learning_design', 'knowledge_structure', 'learning_method', 'learning_analytics']
    };
    
    const currentDomainCategories = domainSpecificCategories[this.currentDomain] || [];
    if (currentDomainCategories.includes(category)) {
      bonus += 0.4; // 领域匹配加成
    }
    
    return bonus;
  }

  /**
   * 安全数字转换 - 防止NaN值
   */
  safeNumber(value, defaultValue = 0) {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
    }
    
    return defaultValue;
  }

  /**
   * 检查是否为有效数字
   */
  isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  /**
   * 初始化增强服务
   */
  async initializeServices() {
    try {
      // 初始化NLP管理器
      await this.initializeNLP();
      
      // 初始化Neo4j连接
      await this.neo4jService.initialize();
      
      logger.info(`所有GraphRAG服务初始化完成，当前领域: ${this.domainConfig.name}`);
    } catch (error) {
      logger.warn('GraphRAG服务初始化部分失败:', error);
    }
  }

  /**
   * 计算基础统计信息
   */
  calculateBasicStatistics(graphData) {
    const { nodes, links } = graphData;
    const nodeTypes = {};
    const categories = {};
    
    nodes.forEach(node => {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
      if (node.category) {
        categories[node.category] = (categories[node.category] || 0) + 1;
      }
    });

    return {
      nodeCount: nodes.length,
      relationshipCount: links.length,
      nodeTypes: Object.keys(nodeTypes),
      categories: Object.keys(categories),
      density: links.length / Math.max(1, nodes.length * (nodes.length - 1) / 2)
    };
  }

  /**
   * 增强关系质量
   */
  enhanceRelationQuality(relations, entities, text) {
    try {
      // 1. 语义关系推断
      const semanticRelations = this.inferSemanticRelationships(relations, entities, text);
      relations.push(...semanticRelations);

      // 2. 层次关系检测
      const hierarchicalRelations = this.detectHierarchicalRelationships(relations, entities);
      relations.push(...hierarchicalRelations);

      // 3. 关系强度计算
      const strengthenedRelations = this.calculateRelationshipStrength(relations, entities, text);

      // 4. 过滤低质量关系
      const filteredRelations = this.filterLowQualityRelations(strengthenedRelations);

      // 5. 关系类型优化
      const optimizedRelations = this.optimizeRelationshipTypes(filteredRelations, entities);

      logger.info(`关系质量增强完成: ${relations.length} -> ${optimizedRelations.length}个关系`);
      return optimizedRelations;

    } catch (error) {
      logger.error('关系质量增强失败:', error);
      return relations; // 返回原始关系
    }
  }

  /**
   * 语义关系推断
   */
  inferSemanticRelationships(existingRelations, entities, text) {
    const semanticRelations = [];
    const existingPairs = new Set();
    
    // 记录已存在的关系对
    existingRelations.forEach(rel => {
      existingPairs.add(`${rel.source}-${rel.target}`);
      existingPairs.add(`${rel.target}-${rel.source}`);
    });

    // 语义关系模式
    const semanticPatterns = [
      {
        condition: (e1, e2) => e1.type === 'tool' && e2.category === 'professional_term',
        relationType: 'tool_implements_concept',
        weight: 0.8,
        description: '工具实现专业概念'
      },
      {
        condition: (e1, e2) => e1.category === 'core_concept' && e2.category === 'business_concept',
        relationType: 'concept_supports_business',
        weight: 0.7,
        description: '核心概念支撑业务概念'
      },
      {
        condition: (e1, e2) => e1.type === 'concept' && e2.type === 'entity' && 
                               (e1.name.includes('分析') && e2.name.includes('数据')),
        relationType: 'analysis_uses_data',
        weight: 0.9,
        description: '分析使用数据'
      },
      {
        condition: (e1, e2) => e1.name.includes('营销') && e2.name.includes('用户'),
        relationType: 'marketing_targets_user',
        weight: 0.8,
        description: '营销针对用户'
      },
      {
        condition: (e1, e2) => e1.category === 'methodology' && e2.category === 'technology',
        relationType: 'method_uses_technology',
        weight: 0.7,
        description: '方法使用技术'
      }
    ];

    // 检查所有实体对
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        const pairKey = `${entity1.id}-${entity2.id}`;

        if (!existingPairs.has(pairKey)) {
          // 检查语义模式
          for (const pattern of semanticPatterns) {
            if (pattern.condition(entity1, entity2) || pattern.condition(entity2, entity1)) {
              // 检查文本上下文支持
              const contextSupport = this.checkContextSupport(entity1, entity2, text);
              if (contextSupport > 0.3) {
                semanticRelations.push({
                  source: entity1.id,
                  target: entity2.id,
                  type: pattern.relationType,
                  weight: pattern.weight * contextSupport,
                  properties: {
                    method: 'semantic_inference',
                    description: pattern.description,
                    contextSupport: contextSupport,
                    confidence: pattern.weight * contextSupport
                  }
                });
                break; // 只匹配第一个模式
              }
            }
          }
        }
      }
    }

    return semanticRelations;
  }

  /**
   * 检查上下文支持度
   */
  checkContextSupport(entity1, entity2, text) {
    // 输入验证
    if (!entity1 || !entity2 || !entity1.name || !entity2.name || !text) {
      return 0;
    }
    
    const name1 = entity1.name.toLowerCase().trim();
    const name2 = entity2.name.toLowerCase().trim();
    
    if (!name1 || !name2 || name1.length === 0 || name2.length === 0) {
      return 0;
    }
    
    // 检查两个实体在同一句话中出现的频率
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 10);
    let cooccurrenceCount = 0;
    let proximityScore = 0;

    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const index1 = lowerSentence.indexOf(name1);
      const index2 = lowerSentence.indexOf(name2);
      
      if (index1 !== -1 && index2 !== -1) {
        cooccurrenceCount++;
        // 距离越近，支持度越高 - 防止除零错误
        const distance = Math.abs(index1 - index2);
        const proximityValue = 1 / (1 + Math.max(distance, 1) / 10);
        if (this.isValidNumber(proximityValue)) {
          proximityScore += proximityValue;
        }
      }
    });

    // 检查特定关系词 - 增加安全检查
    const relationWords = ['用于', '基于', '通过', '实现', '支持', '优化', '分析', '管理'];
    let relationWordScore = 0;
    
    try {
      relationWords.forEach(word => {
        // 转义特殊字符防止正则表达式错误
        const escapedName1 = name1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedName2 = name2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`${escapedName1}[^。]{0,20}${word}[^。]{0,20}${escapedName2}|${escapedName2}[^。]{0,20}${word}[^。]{0,20}${escapedName1}`, 'gi');
        if (pattern.test(text)) {
          relationWordScore += 0.3;
        }
      });
    } catch (regexError) {
      // 正则表达式错误时使用简单字符串匹配
      relationWords.forEach(word => {
        if (text.includes(name1) && text.includes(name2) && text.includes(word)) {
          relationWordScore += 0.1;
        }
      });
    }

    // 确保所有值都是有效数字
    const safeCooccurrenceCount = this.safeNumber(cooccurrenceCount, 0);
    const safeProximityScore = this.safeNumber(proximityScore, 0);
    const safeRelationWordScore = this.safeNumber(relationWordScore, 0);
    
    const finalScore = Math.min(1, Math.max(0, 
      (safeCooccurrenceCount * 0.3 + safeProximityScore * 0.4 + safeRelationWordScore * 0.3)
    ));
    
    return this.safeNumber(finalScore, 0);
  }

  /**
   * 检测层次关系
   */
  detectHierarchicalRelationships(relations, entities) {
    const hierarchicalRelations = [];
    
    // 检测包含关系（父子关系）
    const hierarchyPatterns = [
      {
        parent: (e) => e.category === 'business_concept',
        child: (e) => e.category === 'professional_term',
        relationType: 'contains_concept',
        weight: 0.6
      },
      {
        parent: (e) => e.type === 'concept' && e.weight > 2,
        child: (e) => e.type === 'entity' && e.weight < 2,
        relationType: 'includes_element',
        weight: 0.5
      },
      {
        parent: (e) => e.name.includes('系统') || e.name.includes('平台'),
        child: (e) => e.type === 'tool',
        relationType: 'system_contains_tool',
        weight: 0.7
      }
    ];

    entities.forEach(parent => {
      entities.forEach(child => {
        if (parent.id !== child.id) {
          hierarchyPatterns.forEach(pattern => {
            if (pattern.parent(parent) && pattern.child(child)) {
              // 检查是否已存在相似关系
              const existingRelation = relations.find(r => 
                r.source === parent.id && r.target === child.id
              );
              
              if (!existingRelation) {
                hierarchicalRelations.push({
                  source: parent.id,
                  target: child.id,
                  type: pattern.relationType,
                  weight: pattern.weight,
                  properties: {
                    method: 'hierarchical_detection',
                    relationship_nature: 'hierarchical',
                    parent_concept: parent.name,
                    child_concept: child.name
                  }
                });
              }
            }
          });
        }
      });
    });

    return hierarchicalRelations;
  }

  /**
   * 计算关系强度
   */
  calculateRelationshipStrength(relations, entities, text) {
    const entityMap = new Map(entities.map(e => [e.id, e]));
    
    return relations.map(relation => {
      const sourceEntity = entityMap.get(relation.source);
      const targetEntity = entityMap.get(relation.target);
      
      if (!sourceEntity || !targetEntity) {
        return relation;
      }

      // 确保初始强度是有效数值
      let strength = this.safeNumber(relation.weight, 0.5);
      
      // 基于实体重要性调整 - 增加安全检查
      const sourceWeight = this.safeNumber(sourceEntity.weight, 1);
      const targetWeight = this.safeNumber(targetEntity.weight, 1);
      const entityImportance = Math.sqrt(sourceWeight * targetWeight);
      
      if (this.isValidNumber(entityImportance)) {
        strength *= (0.5 + entityImportance * 0.5);
      }
      
      // 基于关系类型调整
      const typeStrengthMap = {
        'used_for': 0.9,
        'generates': 0.8,
        'contains': 0.7,
        'influences': 0.8,
        'requires': 0.7,
        'optimizes': 0.6,
        'tool_implements_concept': 0.9,
        'concept_supports_business': 0.8,
        'analysis_uses_data': 0.9,
        'marketing_targets_user': 0.8,
        'related_to': 0.4
      };
      
      const typeMultiplier = typeStrengthMap[relation.type] || 0.5;
      strength *= typeMultiplier;
      
      // 基于上下文验证调整 - 增加安全检查
      if (sourceEntity && targetEntity && text) {
        const contextStrength = this.checkContextSupport(sourceEntity, targetEntity, text);
        if (this.isValidNumber(contextStrength)) {
          strength = (strength * 0.7 + contextStrength * 0.3);
        }
      }
      
      // 确保最终结果是有效数值
      const finalStrength = this.safeNumber(strength, 0.5);
      const finalWeight = Math.min(1, Math.max(0.1, finalStrength));
      
      return {
        ...relation,
        weight: finalWeight,
        properties: {
          ...relation.properties,
          calculated_strength: finalStrength,
          entity_importance: this.safeNumber(entityImportance, 1),
          type_multiplier: typeMultiplier
        }
      };
    });
  }

  /**
   * 过滤低质量关系
   */
  filterLowQualityRelations(relations) {
    return relations.filter(relation => {
      // 基本质量检查
      if (!relation.source || !relation.target || relation.source === relation.target) {
        return false;
      }
      
      // 权重过低
      if ((relation.weight || 0) < 0.2) {
        return false;
      }
      
      // 无意义的关系类型
      const meaninglessTypes = ['related_to'];
      if (meaninglessTypes.includes(relation.type) && (relation.weight || 0) < 0.5) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * 优化关系类型
   */
  optimizeRelationshipTypes(relations, entities) {
    const entityMap = new Map(entities.map(e => [e.id, e]));
    
    return relations.map(relation => {
      const sourceEntity = entityMap.get(relation.source);
      const targetEntity = entityMap.get(relation.target);
      
      if (!sourceEntity || !targetEntity) {
        return relation;
      }

      // 基于实体特征优化关系类型
      let optimizedType = relation.type;
      
      // 工具与概念的关系优化
      if (sourceEntity.type === 'tool' && targetEntity.type === 'concept') {
        if (relation.type === 'related_to') {
          optimizedType = 'tool_enables_concept';
        }
      }
      
      // 专业术语间的关系优化
      if (sourceEntity.category === 'professional_term' && targetEntity.category === 'professional_term') {
        if (relation.type === 'related_to' && relation.weight > 0.6) {
          optimizedType = 'professionally_related';
        }
      }
      
      // 核心概念的关系优化
      if (sourceEntity.category === 'core_concept' || targetEntity.category === 'core_concept') {
        if (relation.type === 'related_to' && relation.weight > 0.7) {
          optimizedType = 'core_relationship';
        }
      }
      
      return {
        ...relation,
        type: optimizedType,
        properties: {
          ...relation.properties,
          original_type: relation.type,
          optimized: optimizedType !== relation.type
        }
      };
    });
  }
}

module.exports = GraphRAGService;