const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getDB } = require('../config/database');

// 获取知识库树形结构
router.get('/tree', async (req, res) => {
  try {
    const db = getDB();
    
    // 查询所有知识库节点
    const query = `
      SELECT id, title, content, tags, parent_id, created_at, updated_at
      FROM knowledge_base 
      WHERE user_id = $1 
      ORDER BY parent_id NULLS FIRST, created_at ASC
    `;
    
    const result = await db.query(query, [req.user?.id || 1]); // 暂时使用默认用户ID
    
    // 构建树形结构
    const treeData = buildTreeStructure(result.rows);
    
    res.json({
      success: true,
      data: treeData
    });
  } catch (error) {
    logger.error('获取知识库树形结构失败:', error);
    res.status(500).json({
      success: false,
      message: '获取知识库失败'
    });
  }
});

// 获取单个知识节点详情
router.get('/node/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    
    const query = `
      SELECT id, title, content, tags, parent_id, created_at, updated_at
      FROM knowledge_base 
      WHERE id = $1 AND user_id = $2
    `;
    
    const result = await db.query(query, [id, req.user?.id || 1]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '知识节点不存在'
      });
    }
    
    const node = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: node.id,
        title: node.title,
        content: node.content,
        tags: node.tags || [],
        parentId: node.parent_id,
        type: node.content ? 'item' : 'folder',
        createdAt: node.created_at,
        updatedAt: node.updated_at
      }
    });
  } catch (error) {
    logger.error('获取知识节点详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取节点详情失败'
    });
  }
});

// 创建知识节点
router.post('/node', async (req, res) => {
  try {
    const { title, content, tags, parentId, type } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: '标题不能为空'
      });
    }
    
    const db = getDB();
    
    const query = `
      INSERT INTO knowledge_base (user_id, title, content, tags, parent_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;
    
    const result = await db.query(query, [
      req.user?.id || 1,
      title,
      type === 'folder' ? null : content,
      tags || [],
      parentId || null
    ]);
    
    const newNode = result.rows[0];
    
    logger.info(`知识节点创建成功: ${title}`);
    
    res.json({
      success: true,
      data: {
        id: newNode.id,
        title,
        content: type === 'folder' ? null : content,
        tags: tags || [],
        parentId: parentId || null,
        type,
        createdAt: newNode.created_at,
        updatedAt: newNode.created_at
      },
      message: '创建成功'
    });
  } catch (error) {
    logger.error('创建知识节点失败:', error);
    res.status(500).json({
      success: false,
      message: '创建失败'
    });
  }
});

// 更新知识节点
router.put('/node/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;
    
    const db = getDB();
    
    const query = `
      UPDATE knowledge_base 
      SET title = $1, content = $2, tags = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5
      RETURNING updated_at
    `;
    
    const result = await db.query(query, [
      title,
      content,
      tags || [],
      id,
      req.user?.id || 1
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '知识节点不存在'
      });
    }
    
    logger.info(`知识节点更新成功: ID ${id}`);
    
    res.json({
      success: true,
      data: {
        id,
        title,
        content,
        tags: tags || [],
        updatedAt: result.rows[0].updated_at
      },
      message: '更新成功'
    });
  } catch (error) {
    logger.error('更新知识节点失败:', error);
    res.status(500).json({
      success: false,
      message: '更新失败'
    });
  }
});

// 删除知识节点
router.delete('/node/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    
    // 检查是否有子节点
    const childQuery = `
      SELECT COUNT(*) as child_count 
      FROM knowledge_base 
      WHERE parent_id = $1 AND user_id = $2
    `;
    
    const childResult = await db.query(childQuery, [id, req.user?.id || 1]);
    
    if (parseInt(childResult.rows[0].child_count) > 0) {
      return res.status(400).json({
        success: false,
        message: '请先删除子节点'
      });
    }
    
    // 删除节点
    const deleteQuery = `
      DELETE FROM knowledge_base 
      WHERE id = $1 AND user_id = $2
      RETURNING title
    `;
    
    const result = await db.query(deleteQuery, [id, req.user?.id || 1]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '知识节点不存在'
      });
    }
    
    logger.info(`知识节点删除成功: ${result.rows[0].title}`);
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除知识节点失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败'
    });
  }
});

// 搜索知识库
router.get('/search', async (req, res) => {
  try {
    const { q, tags } = req.query;
    
    if (!q && !tags) {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词或标签'
      });
    }
    
    const db = getDB();
    let query = `
      SELECT id, title, content, tags, parent_id, created_at, updated_at
      FROM knowledge_base 
      WHERE user_id = $1
    `;
    
    const params = [req.user?.id || 1];
    
    if (q) {
      query += ` AND (title ILIKE $${params.length + 1} OR content ILIKE $${params.length + 1})`;
      params.push(`%${q}%`);
    }
    
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query += ` AND tags && $${params.length + 1}`;
      params.push(tagArray);
    }
    
    query += ` ORDER BY updated_at DESC LIMIT 50`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        tags: row.tags || [],
        parentId: row.parent_id,
        type: row.content ? 'item' : 'folder',
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    logger.error('搜索知识库失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败'
    });
  }
});

// 导入预设模板
router.post('/import-template', async (req, res) => {
  try {
    const { templateType } = req.body;
    
    const templates = {
      '营销策略': {
        title: '营销策略模板库',
        children: [
          { title: '目标受众分析', content: '1. 用户画像定义\n2. 需求分析\n3. 痛点识别\n4. 行为特征' },
          { title: '竞品分析', content: '1. 竞品优势分析\n2. 差异化定位\n3. 市场机会挖掘\n4. 策略建议' },
          { title: '内容策略', content: '1. 内容类型规划\n2. 发布频率\n3. 传播渠道选择\n4. 效果评估' },
          { title: 'KPI指标体系', content: '1. 转化率指标\n2. 留存率分析\n3. 传播效果评估\n4. ROI计算' }
        ]
      },
      '文案写作': {
        title: '文案写作技巧库',
        children: [
          { title: '标题公式', content: '恐惧型：不知道X的人，最后都...\n好奇型：为什么X总是...\n对比型：同样是X，差距在哪里\n数字型：X个方法让你...' },
          { title: '开篇技巧', content: '场景代入：上周，一位妈妈哭着找我...\n数据冲击：调研100个案例后发现...\n观点颠覆：都2024了，还在...' },
          { title: '情绪触发词库', content: '焦虑类：来不及、错过、落后\n愤怒类：居然、竟然、简直\n共鸣类：终于、果然、没错\n惊喜类：万万没想到、意外发现' },
          { title: '行动召唤', content: 'CTA设计原则\n紧迫感营造\n利益点强调\n降低行动成本' }
        ]
      },
      '社媒运营': {
        title: '社媒运营手册',
        children: [
          { title: '平台特性', content: '小红书：种草文化、颜值经济\n抖音：算法推荐、短视频\n微信：社交关系、深度内容\nB站：UP主文化、长视频' },
          { title: '最佳发布时间', content: '工作日：19:00-22:00\n周末：10:00-12:00, 14:00-16:00\n根据用户活跃时段调整' },
          { title: '爆款要素', content: '话题标签选择\n标题吸引力\n封面设计\n互动引导\n评论区维护' },
          { title: '数据分析', content: '阅读量分析\n互动率统计\n粉丝增长\n转化效果评估' }
        ]
      }
    };
    
    const template = templates[templateType];
    if (!template) {
      return res.status(400).json({
        success: false,
        message: '模板不存在'
      });
    }
    
    const db = getDB();
    
    // 创建父节点
    const parentQuery = `
      INSERT INTO knowledge_base (user_id, title, content, tags)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const parentResult = await db.query(parentQuery, [
      req.user?.id || 1,
      template.title,
      null,
      [templateType, '模板']
    ]);
    
    const parentId = parentResult.rows[0].id;
    
    // 创建子节点
    for (const child of template.children) {
      await db.query(parentQuery, [
        req.user?.id || 1,
        child.title,
        child.content,
        [templateType, '模板', '内容']
      ]);
    }
    
    logger.info(`模板导入成功: ${templateType}`);
    
    res.json({
      success: true,
      message: `${templateType}模板导入成功`
    });
  } catch (error) {
    logger.error('导入模板失败:', error);
    res.status(500).json({
      success: false,
      message: '导入模板失败'
    });
  }
});

// 构建树形结构的辅助函数
function buildTreeStructure(nodes) {
  const nodeMap = new Map();
  const rootNodes = [];
  
  // 创建节点映射
  nodes.forEach(node => {
    nodeMap.set(node.id, {
      key: node.id.toString(),
      title: node.title,
      icon: node.content ? '<FileOutlined />' : '<FolderOutlined />',
      children: [],
      data: node
    });
  });
  
  // 构建树形关系
  nodes.forEach(node => {
    const treeNode = nodeMap.get(node.id);
    
    if (node.parent_id) {
      const parentNode = nodeMap.get(node.parent_id);
      if (parentNode) {
        parentNode.children.push(treeNode);
      }
    } else {
      rootNodes.push(treeNode);
    }
  });
  
  return rootNodes;
}

module.exports = router;