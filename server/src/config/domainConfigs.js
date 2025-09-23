/**
 * 多领域配置文件
 * 支持不同专业领域的实体识别、关系推理和分析模式
 */

const domainConfigs = {
  // 数字营销领域
  marketing: {
    name: '数字营销',
    description: '内容营销、用户增长、数据分析等营销相关概念',
    
    // 核心概念库
    coreTerms: [
      '内容营销', '数字营销', '用户体验', '数据分析', '人工智能', 
      '机器学习', '自动化', '优化', '营销策略', '客户关系',
      '品牌建设', '市场推广', 'ROI', '转化率', '用户画像',
      '营销漏斗', '客户旅程', '增长黑客', 'A/B测试', '用户留存'
    ],

    // 专业工具识别模式
    toolPatterns: [
      // 营销工具和平台
      /(Google Analytics [0-9]+|Google Analytics|GA4|LinkedIn|Facebook|Instagram|TikTok|微信公众号|小红书|抖音|YouTube)/gi,
      // 营销自动化工具
      /(HubSpot|Salesforce|Mailchimp|ConvertKit|ActiveCampaign|Klaviyo)/gi,
      // 数据分析工具
      /(Tableau|Power BI|Google Data Studio|Mixpanel|Amplitude|Hotjar)/gi,
      // 内容管理系统
      /(WordPress|Shopify|Wix|Squarespace|Ghost|Medium)/gi
    ],

    // 业务概念模式
    conceptPatterns: [
      /(内容营销策略|品牌营销|数字营销|社交媒体营销|邮件营销|影响者营销|病毒营销|精准营销|内容分发|流量获取)/g,
      /(用户体验设计|用户界面设计|转化率优化|着陆页优化|营销漏斗优化|客户体验优化)/g,
      /(数据分析报告|市场调研报告|竞品分析报告|用户行为分析|流量分析|转化分析|ROI分析)/g,
      /(客户关系管理|销售漏斗|客户细分|客户满意度|客户终身价值|客户获取成本)/g
    ],

    // 关系推理模式
    relationPatterns: [
      { pattern: /(.{2,15})(用于|适用于|应用于)(.{2,15})/g, type: 'used_for', weight: 0.8 },
      { pattern: /(.{2,15})(优化|改进|提升)(.{2,15})/g, type: 'optimizes', weight: 0.9 },
      { pattern: /(.{2,15})(分析|评估|监控)(.{2,15})/g, type: 'analyzes', weight: 0.8 },
      { pattern: /(.{2,15})(驱动|推动|促进)(.{2,15})/g, type: 'drives', weight: 0.7 },
      { pattern: /(.{2,15})(转化为|转换成)(.{2,15})/g, type: 'converts_to', weight: 0.9 }
    ],

    // 重要术语权重
    termWeights: {
      'ROI': 3.0,
      '转化率': 3.0,
      '用户画像': 2.8,
      '营销漏斗': 2.8,
      '客户终身价值': 2.5,
      '数据驱动': 2.5
    }
  },

  // 技术开发领域
  technology: {
    name: '技术开发',
    description: '软件开发、系统架构、技术工具等技术相关概念',
    
    coreTerms: [
      '软件架构', '系统设计', '性能优化', '用户体验', '前端开发',
      '后端开发', '全栈开发', '微服务', '容器化', '云计算',
      '数据库设计', 'API设计', '安全架构', '测试驱动', '持续集成'
    ],

    toolPatterns: [
      // 开发工具
      /(Visual Studio Code|VS Code|IntelliJ|Eclipse|Sublime Text|Atom)/gi,
      // 框架和库
      /(React|Vue|Angular|Node\.js|Express|Django|Flask|Spring|Laravel)/gi,
      // 数据库
      /(MongoDB|PostgreSQL|MySQL|Redis|Elasticsearch|Neo4j)/gi,
      // 云服务和容器
      /(Docker|Kubernetes|AWS|Azure|Google Cloud|Vercel|Netlify)/gi,
      // 版本控制和CI/CD
      /(Git|GitHub|GitLab|Jenkins|CircleCI|Travis CI)/gi
    ],

    conceptPatterns: [
      /(软件架构设计|系统架构设计|微服务架构|分布式系统|高可用架构|可扩展架构)/g,
      /(性能优化|代码优化|数据库优化|前端优化|后端优化|系统调优)/g,
      /(用户体验设计|交互设计|界面设计|可用性测试|响应式设计)/g,
      /(代码质量|单元测试|集成测试|自动化测试|测试驱动开发|持续集成)/g
    ],

    relationPatterns: [
      { pattern: /(.{2,15})(基于|构建于|使用)(.{2,15})/g, type: 'built_with', weight: 0.9 },
      { pattern: /(.{2,15})(实现|执行|运行)(.{2,15})/g, type: 'implements', weight: 0.8 },
      { pattern: /(.{2,15})(优化|改善|提升)(.{2,15})/g, type: 'optimizes', weight: 0.8 },
      { pattern: /(.{2,15})(集成|整合|连接)(.{2,15})/g, type: 'integrates', weight: 0.7 },
      { pattern: /(.{2,15})(部署到|发布到)(.{2,15})/g, type: 'deployed_to', weight: 0.8 }
    ],

    termWeights: {
      '性能优化': 3.0,
      '系统架构': 3.0,
      '用户体验': 2.8,
      '微服务': 2.5,
      '云计算': 2.5,
      '数据安全': 2.8
    }
  },

  // 商业管理领域
  business: {
    name: '商业管理',
    description: '企业管理、商业策略、运营优化等商业相关概念',
    
    coreTerms: [
      '商业模式', '战略规划', '运营管理', '项目管理', '人力资源',
      '财务管理', '风险管理', '供应链', '客户服务', '组织架构',
      '业务流程', '绩效管理', '创新管理', '变革管理', '领导力'
    ],

    toolPatterns: [
      // 商业分析工具
      /(Excel|Power BI|Tableau|SAP|Oracle|ERP系统)/gi,
      // 项目管理工具
      /(Jira|Trello|Asana|Monday\.com|Notion|Slack|Microsoft Teams)/gi,
      // 财务工具
      /(QuickBooks|Xero|FreshBooks|用友|金蝶)/gi,
      // CRM系统
      /(Salesforce|HubSpot|Zoho|Pipedrive|客如云)/gi
    ],

    conceptPatterns: [
      /(商业模式创新|盈利模式|收入模型|成本结构|价值主张|核心竞争力)/g,
      /(战略规划|市场策略|竞争策略|发展战略|数字化转型|业务转型)/g,
      /(运营管理|流程优化|效率提升|成本控制|质量管理|供应链管理)/g,
      /(团队管理|人才发展|绩效考核|组织文化|领导力发展|变革管理)/g
    ],

    relationPatterns: [
      { pattern: /(.{2,15})(管理|控制|监督)(.{2,15})/g, type: 'manages', weight: 0.8 },
      { pattern: /(.{2,15})(支持|支撑|服务)(.{2,15})/g, type: 'supports', weight: 0.7 },
      { pattern: /(.{2,15})(影响|决定|驱动)(.{2,15})/g, type: 'influences', weight: 0.8 },
      { pattern: /(.{2,15})(协调|整合|统筹)(.{2,15})/g, type: 'coordinates', weight: 0.7 },
      { pattern: /(.{2,15})(评估|衡量|考核)(.{2,15})/g, type: 'evaluates', weight: 0.8 }
    ],

    termWeights: {
      '商业模式': 3.0,
      '战略规划': 2.8,
      '核心竞争力': 2.8,
      '运营效率': 2.5,
      '团队协作': 2.5,
      '数字化转型': 3.0
    }
  },

  // 教育培训领域
  education: {
    name: '教育培训',
    description: '在线教育、知识传递、学习体验等教育相关概念',
    
    coreTerms: [
      '在线教育', '知识管理', '学习体验', '课程设计', '教学方法',
      '学习路径', '知识图谱', '个性化学习', '学习分析', '教育技术',
      '培训体系', '能力建模', '学习评估', '知识沉淀', '经验传承'
    ],

    toolPatterns: [
      // 在线教育平台
      /(腾讯课堂|网易云课堂|知乎Live|得到|混沌大学|三节课)/gi,
      // 学习管理系统
      /(Moodle|Canvas|Blackboard|钉钉|企业微信|飞书)/gi,
      // 知识管理工具
      /(Notion|Obsidian|Roam Research|语雀|石墨文档|腾讯文档)/gi,
      // 直播和会议工具
      /(Zoom|腾讯会议|钉钉|Webex|Teams|ClassIn)/gi
    ],

    conceptPatterns: [
      /(在线教育|远程学习|混合式学习|翻转课堂|微学习|移动学习)/g,
      /(课程设计|教学设计|学习路径设计|知识体系构建|能力模型|胜任力模型)/g,
      /(学习体验|用户体验|交互设计|学习界面|学习工具|学习环境)/g,
      /(学习分析|学习数据|学习效果评估|知识掌握度|学习进度跟踪)/g
    ],

    relationPatterns: [
      { pattern: /(.{2,15})(教授|传授|讲解)(.{2,15})/g, type: 'teaches', weight: 0.9 },
      { pattern: /(.{2,15})(学习|掌握|理解)(.{2,15})/g, type: 'learns', weight: 0.8 },
      { pattern: /(.{2,15})(应用|实践|运用)(.{2,15})/g, type: 'applies', weight: 0.8 },
      { pattern: /(.{2,15})(评估|考核|测试)(.{2,15})/g, type: 'evaluates', weight: 0.7 },
      { pattern: /(.{2,15})(指导|辅导|培养)(.{2,15})/g, type: 'guides', weight: 0.8 }
    ],

    termWeights: {
      '学习体验': 3.0,
      '知识图谱': 2.8,
      '个性化学习': 2.8,
      '学习分析': 2.5,
      '能力建模': 2.5,
      '知识沉淀': 2.8
    }
  },

  // 通用领域（平衡各领域，降低偏向性）
  general: {
    name: '通用分析',
    description: '跨领域通用概念，适合发现创新连接和跨界洞察',
    
    coreTerms: [
      '创新', '效率', '质量', '体验', '价值', '成本', '风险', '机会',
      '策略', '方法', '工具', '系统', '流程', '标准', '模式', '框架'
    ],

    toolPatterns: [
      // 通用工具（不限领域）
      /(Microsoft Office|Google Workspace|Zoom|Slack|Teams|Notion)/gi,
      // 分析工具
      /(Excel|Google Sheets|PowerPoint|Word|PDF|数据库|电子表格)/gi,
      // 通信协作工具
      /(邮件|电话|视频会议|即时通讯|协作平台|云存储)/gi
    ],

    conceptPatterns: [
      // 通用商业概念
      /(价值创造|效率提升|成本优化|质量改进|用户满意|客户价值)/g,
      // 通用管理概念
      /(流程优化|标准化|规范化|自动化|数字化|智能化)/g,
      // 通用创新概念
      /(创新思维|设计思维|系统思维|批判性思维|解决方案|最佳实践)/g
    ],

    relationPatterns: [
      { pattern: /(.{2,15})(影响|作用于|关联)(.{2,15})/g, type: 'relates_to', weight: 0.5 },
      { pattern: /(.{2,15})(导致|引起|产生)(.{2,15})/g, type: 'causes', weight: 0.7 },
      { pattern: /(.{2,15})(支持|促进|推动)(.{2,15})/g, type: 'supports', weight: 0.6 },
      { pattern: /(.{2,15})(需要|依赖|要求)(.{2,15})/g, type: 'requires', weight: 0.6 },
      { pattern: /(.{2,15})(包含|包括|涵盖)(.{2,15})/g, type: 'includes', weight: 0.6 }
    ],

    termWeights: {
      // 通用概念权重相对较低，避免过度强调
      '创新': 2.0,
      '效率': 2.0,
      '价值': 2.0,
      '体验': 2.0,
      '质量': 1.8,
      '策略': 1.8
    }
  }
};

/**
 * 获取指定领域的配置
 */
function getDomainConfig(domain = 'general') {
  return domainConfigs[domain] || domainConfigs.general;
}

/**
 * 获取所有可用领域
 */
function getAvailableDomains() {
  return Object.keys(domainConfigs).map(key => ({
    key,
    name: domainConfigs[key].name,
    description: domainConfigs[key].description
  }));
}

/**
 * 混合多个领域配置（用于跨领域分析）
 */
function mergeDomainConfigs(domains, weights = {}) {
  const mergedConfig = {
    name: `混合领域: ${domains.map(d => domainConfigs[d]?.name).join('、')}`,
    description: '跨领域混合分析配置',
    coreTerms: [],
    toolPatterns: [],
    conceptPatterns: [],
    relationPatterns: [],
    termWeights: {}
  };

  domains.forEach(domain => {
    const config = domainConfigs[domain];
    if (!config) return;

    const weight = weights[domain] || 1;

    // 合并核心术语
    mergedConfig.coreTerms.push(...config.coreTerms);
    
    // 合并模式
    mergedConfig.toolPatterns.push(...config.toolPatterns);
    mergedConfig.conceptPatterns.push(...config.conceptPatterns);
    mergedConfig.relationPatterns.push(...config.relationPatterns.map(pattern => ({
      ...pattern,
      weight: pattern.weight * weight
    })));

    // 合并术语权重
    Object.entries(config.termWeights).forEach(([term, termWeight]) => {
      mergedConfig.termWeights[term] = (mergedConfig.termWeights[term] || 0) + (termWeight * weight);
    });
  });

  // 去重
  mergedConfig.coreTerms = [...new Set(mergedConfig.coreTerms)];

  return mergedConfig;
}

module.exports = {
  domainConfigs,
  getDomainConfig,
  getAvailableDomains,
  mergeDomainConfigs
};