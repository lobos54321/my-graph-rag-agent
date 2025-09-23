const logger = require('../utils/logger');
const crypto = require('crypto');

class GraphStateManager {
  constructor() {
    this.graphHistory = new Map(); // 存储历史版本
    this.changeLog = [];           // 变更日志
    this.entityIndex = new Map();  // 实体索引
    this.relationshipIndex = new Map(); // 关系索引
  }

  /**
   * 计算图谱变更增量
   */
  async calculateGraphDelta(newGraphData, existingGraphData = null) {
    if (!existingGraphData) {
      return {
        type: 'initial',
        addedNodes: newGraphData.nodes,
        addedLinks: newGraphData.links,
        modifiedNodes: [],
        deletedNodes: [],
        modifiedLinks: [],
        deletedLinks: []
      };
    }

    const delta = {
      type: 'incremental',
      addedNodes: [],
      modifiedNodes: [],
      deletedNodes: [],
      addedLinks: [],
      modifiedLinks: [],
      deletedLinks: []
    };

    // 构建现有节点索引
    const existingNodeMap = new Map(existingGraphData.nodes.map(n => [n.id, n]));
    const newNodeMap = new Map(newGraphData.nodes.map(n => [n.id, n]));

    // 检测节点变更
    for (const newNode of newGraphData.nodes) {
      const existingNode = existingNodeMap.get(newNode.id);
      if (!existingNode) {
        delta.addedNodes.push(newNode);
      } else if (this.hasNodeChanged(existingNode, newNode)) {
        delta.modifiedNodes.push({
          old: existingNode,
          new: newNode,
          changes: this.getNodeChanges(existingNode, newNode)
        });
      }
    }

    // 检测删除的节点
    for (const existingNode of existingGraphData.nodes) {
      if (!newNodeMap.has(existingNode.id)) {
        delta.deletedNodes.push(existingNode);
      }
    }

    // 检测关系变更
    const existingLinkMap = new Map(existingGraphData.links.map(l => 
      [`${l.source}-${l.target}-${l.type}`, l]
    ));
    const newLinkMap = new Map(newGraphData.links.map(l => 
      [`${l.source}-${l.target}-${l.type}`, l]
    ));

    for (const newLink of newGraphData.links) {
      const linkKey = `${newLink.source}-${newLink.target}-${newLink.type}`;
      const existingLink = existingLinkMap.get(linkKey);
      
      if (!existingLink) {
        delta.addedLinks.push(newLink);
      } else if (this.hasLinkChanged(existingLink, newLink)) {
        delta.modifiedLinks.push({
          old: existingLink,
          new: newLink,
          changes: this.getLinkChanges(existingLink, newLink)
        });
      }
    }

    // 检测删除的关系
    for (const existingLink of existingGraphData.links) {
      const linkKey = `${existingLink.source}-${existingLink.target}-${existingLink.type}`;
      if (!newLinkMap.has(linkKey)) {
        delta.deletedLinks.push(existingLink);
      }
    }

    return delta;
  }

  /**
   * 应用增量更新
   */
  async applyDelta(existingGraphData, delta) {
    const updatedGraph = {
      nodes: [...existingGraphData.nodes],
      links: [...existingGraphData.links],
      metadata: {
        ...existingGraphData.metadata,
        lastUpdated: new Date().toISOString(),
        updateType: delta.type,
        changeCount: this.calculateChangeCount(delta)
      }
    };

    // 应用节点更新
    if (delta.addedNodes.length > 0) {
      updatedGraph.nodes.push(...delta.addedNodes);
    }

    if (delta.modifiedNodes.length > 0) {
      delta.modifiedNodes.forEach(({old, new: newNode}) => {
        const index = updatedGraph.nodes.findIndex(n => n.id === old.id);
        if (index !== -1) {
          updatedGraph.nodes[index] = { ...newNode };
        }
      });
    }

    if (delta.deletedNodes.length > 0) {
      const deletedIds = new Set(delta.deletedNodes.map(n => n.id));
      updatedGraph.nodes = updatedGraph.nodes.filter(n => !deletedIds.has(n.id));
    }

    // 应用关系更新
    if (delta.addedLinks.length > 0) {
      updatedGraph.links.push(...delta.addedLinks);
    }

    if (delta.modifiedLinks.length > 0) {
      delta.modifiedLinks.forEach(({old, new: newLink}) => {
        const index = updatedGraph.links.findIndex(l => 
          l.source === old.source && l.target === old.target && l.type === old.type
        );
        if (index !== -1) {
          updatedGraph.links[index] = { ...newLink };
        }
      });
    }

    if (delta.deletedLinks.length > 0) {
      const deletedLinkKeys = new Set(delta.deletedLinks.map(l => 
        `${l.source}-${l.target}-${l.type}`
      ));
      updatedGraph.links = updatedGraph.links.filter(l => {
        const key = `${l.source}-${l.target}-${l.type}`;
        return !deletedLinkKeys.has(key);
      });
    }

    // 记录变更日志
    this.logChanges(delta);

    // 更新元数据
    updatedGraph.metadata.nodeCount = updatedGraph.nodes.length;
    updatedGraph.metadata.linkCount = updatedGraph.links.length;

    return updatedGraph;
  }

  /**
   * 智能实体合并
   */
  async mergeEntities(entities) {
    const mergedEntities = [];
    const processedIds = new Set();

    for (const entity of entities) {
      if (processedIds.has(entity.id)) continue;

      // 寻找相似实体
      const similarEntities = entities.filter(e => 
        e.id !== entity.id && 
        !processedIds.has(e.id) && 
        this.calculateEntitySimilarity(entity, e) > 0.8
      );

      if (similarEntities.length > 0) {
        // 合并相似实体
        const mergedEntity = this.combineEntities([entity, ...similarEntities]);
        mergedEntities.push(mergedEntity);
        
        processedIds.add(entity.id);
        similarEntities.forEach(e => processedIds.add(e.id));
      } else {
        mergedEntities.push(entity);
        processedIds.add(entity.id);
      }
    }

    return mergedEntities;
  }

  /**
   * 辅助方法
   */
  hasNodeChanged(oldNode, newNode) {
    return JSON.stringify(oldNode) !== JSON.stringify(newNode);
  }

  hasLinkChanged(oldLink, newLink) {
    return oldLink.weight !== newLink.weight || 
           JSON.stringify(oldLink.properties) !== JSON.stringify(newLink.properties);
  }

  getNodeChanges(oldNode, newNode) {
    const changes = {};
    if (oldNode.weight !== newNode.weight) changes.weight = {old: oldNode.weight, new: newNode.weight};
    if (oldNode.name !== newNode.name) changes.name = {old: oldNode.name, new: newNode.name};
    return changes;
  }

  getLinkChanges(oldLink, newLink) {
    const changes = {};
    if (oldLink.weight !== newLink.weight) changes.weight = {old: oldLink.weight, new: newLink.weight};
    return changes;
  }

  calculateChangeCount(delta) {
    return delta.addedNodes.length + delta.modifiedNodes.length + delta.deletedNodes.length +
           delta.addedLinks.length + delta.modifiedLinks.length + delta.deletedLinks.length;
  }

  calculateEntitySimilarity(entity1, entity2) {
    // 基于名称、类型、类别的相似度计算
    let similarity = 0;
    
    if (entity1.name === entity2.name) similarity += 0.5;
    if (entity1.type === entity2.type) similarity += 0.3;  
    if (entity1.category === entity2.category) similarity += 0.2;
    
    return similarity;
  }

  combineEntities(entities) {
    const combined = { ...entities[0] };
    
    // 合并权重（取最大值）
    combined.weight = Math.max(...entities.map(e => e.weight || 0));
    
    // 合并属性
    combined.properties = entities.reduce((acc, entity) => ({
      ...acc,
      ...entity.properties
    }), {});

    return combined;
  }

  logChanges(delta) {
    const changeEntry = {
      timestamp: new Date().toISOString(),
      changeId: crypto.randomUUID(),
      summary: {
        nodesAdded: delta.addedNodes.length,
        nodesModified: delta.modifiedNodes.length,
        nodesDeleted: delta.deletedNodes.length,
        linksAdded: delta.addedLinks.length,
        linksModified: delta.modifiedLinks.length,
        linksDeleted: delta.deletedLinks.length
      },
      delta
    };

    this.changeLog.unshift(changeEntry);
    
    // 保持最新的100条变更记录
    if (this.changeLog.length > 100) {
      this.changeLog = this.changeLog.slice(0, 100);
    }

    logger.info(`图谱变更记录: ${JSON.stringify(changeEntry.summary)}`);
  }

  /**
   * 获取变更历史
   */
  getChangeHistory(limit = 10) {
    return this.changeLog.slice(0, limit);
  }
}

module.exports = GraphStateManager;