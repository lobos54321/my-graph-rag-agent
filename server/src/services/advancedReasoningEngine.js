const logger = require('../utils/logger');

class AdvancedReasoningEngine {
  constructor() {
    this.reasoningCache = new Map();
    this.causalPatterns = [
      { pattern: /(.{2,15})(导致|引起|产生)(.{2,15})/g, type: 'causes' },
      { pattern: /(.{2,15})(由于|因为|基于)(.{2,15})/g, type: 'caused_by' },
      { pattern: /(.{2,15})(影响|决定|驱动)(.{2,15})/g, type: 'influences' },
      { pattern: /(.{2,15})(需要|要求|依赖)(.{2,15})/g, type: 'requires' },
      { pattern: /(.{2,15})(优化|改进|提升)(.{2,15})/g, type: 'optimizes' }
    ];
  }

  /**
   * 多跳路径发现 (增强版)
   */
  async findMultiHopPaths(graphData, startEntityId, targetEntityId, maxHops = 4) {
    const cacheKey = `${startEntityId}-${targetEntityId}-${maxHops}`;
    if (this.reasoningCache.has(cacheKey)) {
      return this.reasoningCache.get(cacheKey);
    }

    const { nodes, links } = graphData;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // 构建邻接表
    const adjacencyList = this.buildWeightedAdjacencyList(nodes, links);
    
    const allPaths = [];
    const visited = new Set();
    
    // 深度优先搜索with语义评分
    await this.dfsWithSemanticScoring(
      startEntityId, 
      targetEntityId, 
      [], 
      visited, 
      allPaths, 
      0, 
      maxHops, 
      adjacencyList,
      nodeMap
    );

    // 按相关性排序路径
    const rankedPaths = this.rankPathsByRelevance(allPaths, nodeMap);
    
    // 缓存结果
    this.reasoningCache.set(cacheKey, rankedPaths);
    
    return rankedPaths;
  }

  /**
   * 深度优先搜索with语义评分
   */
  async dfsWithSemanticScoring(currentId, targetId, currentPath, visited, allPaths, currentDepth, maxDepth, adjacencyList, nodeMap) {
    if (currentDepth > maxDepth) return;
    
    if (currentId === targetId && currentPath.length > 1) {
      const pathScore = this.calculatePathSemanticScore(currentPath, nodeMap, adjacencyList);
      allPaths.push({
        path: [...currentPath, currentId],
        score: pathScore,
        confidence: this.calculatePathConfidence(currentPath, adjacencyList),
        reasoning: this.generatePathReasoning(currentPath, nodeMap)
      });
      return;
    }

    visited.add(currentId);
    const newPath = [...currentPath, currentId];

    const neighbors = adjacencyList.get(currentId) || [];
    
    // 按权重排序邻居节点
    const sortedNeighbors = neighbors.sort((a, b) => b.weight - a.weight);

    for (const neighbor of sortedNeighbors) {
      if (!visited.has(neighbor.target)) {
        await this.dfsWithSemanticScoring(
          neighbor.target, 
          targetId, 
          newPath, 
          visited, 
          allPaths, 
          currentDepth + 1, 
          maxDepth, 
          adjacencyList, 
          nodeMap
        );
      }
    }

    visited.delete(currentId);
  }

  /**
   * 因果推理链构建
   */
  async buildCausalChains(graphData, textContent = '') {
    const causalRelations = [];
    
    // 从文本中提取因果关系
    if (textContent) {
      const textualCausalRelations = this.extractCausalFromText(textContent, graphData.nodes);
      causalRelations.push(...textualCausalRelations);
    }

    // 从图结构中推断因果关系
    const structuralCausalRelations = this.inferCausalFromStructure(graphData);
    causalRelations.push(...structuralCausalRelations);

    // 构建因果链
    const causalChains = this.buildCausalSequences(causalRelations);

    return {
      causalRelations,
      causalChains,
      insights: this.generateCausalInsights(causalChains)
    };
  }

  /**
   * 反向推理 - 从结果推原因
   */
  async reverseReasoning(graphData, effectEntityId, maxDepth = 3) {
    const { nodes, links } = graphData;
    const effectNode = nodes.find(n => n.id === effectEntityId);
    
    if (!effectNode) {
      throw new Error(`未找到效果实体: ${effectEntityId}`);
    }

    // 找到所有指向该节点的关系
    const incomingLinks = links.filter(link => link.target === effectEntityId);
    const potentialCauses = [];

    for (const link of incomingLinks) {
      const causeNode = nodes.find(n => n.id === link.source);
      if (causeNode) {
        const reasoning = this.analyzeReverseCausality(causeNode, effectNode, link);
        potentialCauses.push({
          cause: causeNode,
          effect: effectNode,
          relationship: link,
          reasoning,
          confidence: this.calculateReverseCausalityConfidence(causeNode, effectNode, link)
        });
      }
    }

    // 递归查找更深层的原因
    if (maxDepth > 1) {
      for (const potentialCause of potentialCauses.slice()) {
        const deeperCauses = await this.reverseReasoning(graphData, potentialCause.cause.id, maxDepth - 1);
        potentialCauses.push(...deeperCauses.potentialCauses.map(dc => ({
          ...dc,
          depth: (potentialCause.depth || 1) + 1
        })));
      }
    }

    return {
      effect: effectNode,
      potentialCauses: potentialCauses.sort((a, b) => b.confidence - a.confidence),
      insights: this.generateReverseReasoningInsights(effectNode, potentialCauses)
    };
  }

  /**
   * 类比推理
   */
  async analogicalReasoning(graphData, sourcePattern, targetDomain) {
    const analogies = [];
    const { nodes, links } = graphData;

    // 识别源模式的结构特征
    const sourceStructure = this.extractStructuralPattern(sourcePattern, nodes, links);
    
    // 在目标域中寻找相似结构
    const targetNodes = nodes.filter(n => 
      n.category === targetDomain || 
      n.properties?.domain === targetDomain
    );

    for (const targetNode of targetNodes) {
      const targetStructure = this.extractNodeStructure(targetNode, nodes, links);
      const similarity = this.calculateStructuralSimilarity(sourceStructure, targetStructure);
      
      if (similarity > 0.6) {
        analogies.push({
          source: sourcePattern,
          target: targetNode,
          similarity,
          mapping: this.createConceptualMapping(sourceStructure, targetStructure),
          predictions: this.generateAnalogicalPredictions(sourceStructure, targetStructure)
        });
      }
    }

    return analogies.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 辅助方法
   */
  buildWeightedAdjacencyList(nodes, links) {
    const adjacencyList = new Map();
    
    nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });

    links.forEach(link => {
      if (adjacencyList.has(link.source)) {
        adjacencyList.get(link.source).push({
          target: link.target,
          weight: link.weight || 1,
          type: link.type
        });
      }
      
      // 如果是无向图，添加反向连接
      if (adjacencyList.has(link.target)) {
        adjacencyList.get(link.target).push({
          target: link.source,
          weight: link.weight || 1,
          type: link.type
        });
      }
    });

    return adjacencyList;
  }

  calculatePathSemanticScore(path, nodeMap, adjacencyList) {
    let totalScore = 0;
    let pathLength = path.length;

    for (let i = 0; i < pathLength - 1; i++) {
      const currentNode = nodeMap.get(path[i]);
      const nextNode = nodeMap.get(path[i + 1]);
      
      if (currentNode && nextNode) {
        // 节点重要性分数
        const nodeScore = (currentNode.weight || 1) * (nextNode.weight || 1);
        
        // 连接强度评分
        const neighbors = adjacencyList.get(path[i]) || [];
        const connection = neighbors.find(n => n.target === path[i + 1]);
        const connectionScore = connection ? connection.weight : 0.5;
        
        totalScore += nodeScore * connectionScore;
      }
    }

    // 路径长度惩罚
    const lengthPenalty = 1 / Math.max(1, pathLength - 2);
    
    return totalScore * lengthPenalty;
  }

  calculatePathConfidence(path, adjacencyList) {
    if (path.length < 2) return 0;
    
    let totalWeight = 0;
    let connectionCount = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const neighbors = adjacencyList.get(path[i]) || [];
      const connection = neighbors.find(n => n.target === path[i + 1]);
      
      if (connection) {
        totalWeight += connection.weight;
        connectionCount++;
      }
    }

    return connectionCount > 0 ? totalWeight / connectionCount : 0;
  }

  generatePathReasoning(path, nodeMap) {
    if (path.length < 3) return '路径过短，无法生成推理';

    const pathNodes = path.map(id => nodeMap.get(id)).filter(n => n);
    const start = pathNodes[0];
    const end = pathNodes[pathNodes.length - 1];
    const intermediate = pathNodes.slice(1, -1);

    if (intermediate.length === 0) {
      return `${start.name} 与 ${end.name} 直接相关`;
    }

    const intermediateNames = intermediate.map(n => n.name).join(' → ');
    return `从 ${start.name} 通过 ${intermediateNames} 可以推理到 ${end.name}`;
  }

  rankPathsByRelevance(paths, nodeMap) {
    return paths
      .sort((a, b) => {
        // 综合评分：语义分数 * 置信度
        const scoreA = a.score * a.confidence;
        const scoreB = b.score * b.confidence;
        return scoreB - scoreA;
      })
      .slice(0, 10) // 返回前10个最相关的路径
      .map(path => ({
        ...path,
        pathNames: path.path.map(id => nodeMap.get(id)?.name || id),
        summary: this.generatePathSummary(path, nodeMap)
      }));
  }

  generatePathSummary(path, nodeMap) {
    const pathNodes = path.path.map(id => nodeMap.get(id)).filter(n => n);
    const start = pathNodes[0]?.name || '未知';
    const end = pathNodes[pathNodes.length - 1]?.name || '未知';
    
    return `发现了从"${start}"到"${end}"的推理路径，置信度: ${(path.confidence * 100).toFixed(1)}%`;
  }

  /**
   * 从图结构推断因果关系
   */
  inferCausalFromStructure(graphData) {
    const causalRelations = [];
    const { nodes, links } = graphData;
    
    // 基于特定关系类型推断因果关系
    const causalRelationTypes = ['used_for', 'generates', 'influences', 'optimizes', 'requires'];
    
    links.forEach(link => {
      if (causalRelationTypes.includes(link.type)) {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        
        if (sourceNode && targetNode) {
          causalRelations.push({
            cause: sourceNode,
            effect: targetNode,
            type: 'structural_causal',
            confidence: link.weight || 0.5,
            source: 'graph_structure',
            evidence: `${link.type} relationship between ${sourceNode.name} and ${targetNode.name}`
          });
        }
      }
    });
    
    return causalRelations;
  }

  extractCausalFromText(text, nodes) {
    const causalRelations = [];
    
    this.causalPatterns.forEach(patternObj => {
      let match;
      while ((match = patternObj.pattern.exec(text)) !== null) {
        const cause = match[1]?.trim();
        const effect = match[3]?.trim();
        
        if (cause && effect) {
          // 尝试匹配到实际节点
          const causeNode = this.findMatchingNode(cause, nodes);
          const effectNode = this.findMatchingNode(effect, nodes);
          
          if (causeNode && effectNode) {
            causalRelations.push({
              cause: causeNode,
              effect: effectNode,
              type: patternObj.type,
              confidence: 0.7,
              source: 'text_analysis',
              evidence: match[0]
            });
          }
        }
      }
    });

    return causalRelations;
  }

  /**
   * 构建因果序列链
   */
  buildCausalSequences(causalRelations) {
    const causalChains = [];
    const processedRelations = new Set();
    
    causalRelations.forEach((relation, index) => {
      if (processedRelations.has(index)) return;
      
      const chain = [relation];
      processedRelations.add(index);
      
      // 向前查找
      let currentEffect = relation.effect;
      let foundNext = true;
      
      while (foundNext) {
        foundNext = false;
        causalRelations.forEach((nextRelation, nextIndex) => {
          if (!processedRelations.has(nextIndex) && 
              nextRelation.cause.id === currentEffect.id) {
            chain.push(nextRelation);
            processedRelations.add(nextIndex);
            currentEffect = nextRelation.effect;
            foundNext = true;
          }
        });
      }
      
      if (chain.length >= 2) {
        causalChains.push({
          id: `chain_${causalChains.length}`,
          sequence: chain,
          length: chain.length,
          confidence: chain.reduce((sum, rel) => sum + rel.confidence, 0) / chain.length,
          description: this.generateChainDescription(chain)
        });
      }
    });
    
    return causalChains.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 生成因果洞察
   */
  generateCausalInsights(causalChains) {
    const insights = [];
    
    causalChains.forEach(chain => {
      const startEntity = chain.sequence[0].cause.name;
      const endEntity = chain.sequence[chain.sequence.length - 1].effect.name;
      const pathLength = chain.length;
      
      insights.push({
        type: 'causal_chain',
        title: `${startEntity} → ${endEntity} 因果链`,
        description: `发现${pathLength}步因果关系链: ${chain.description}`,
        confidence: chain.confidence,
        implications: [
          `${startEntity}的变化会影响${endEntity}`,
          pathLength > 2 ? '存在间接影响路径' : '存在直接因果关系',
          `影响强度: ${(chain.confidence * 100).toFixed(1)}%`
        ]
      });
    });
    
    // 识别关键节点
    const nodeInfluence = new Map();
    causalChains.forEach(chain => {
      chain.sequence.forEach(relation => {
        const causeId = relation.cause.id;
        if (!nodeInfluence.has(causeId)) {
          nodeInfluence.set(causeId, { node: relation.cause, count: 0, totalConfidence: 0 });
        }
        nodeInfluence.get(causeId).count++;
        nodeInfluence.get(causeId).totalConfidence += relation.confidence;
      });
    });
    
    const influentialNodes = Array.from(nodeInfluence.entries())
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 3);
    
    influentialNodes.forEach(([nodeId, data]) => {
      insights.push({
        type: 'influential_node',
        title: `关键影响因子: ${data.node.name}`,
        description: `该实体在${data.count}个因果链中起关键作用`,
        confidence: data.totalConfidence / data.count,
        implications: [
          '是系统中的重要杠杆点',
          '变化会产生连锁反应',
          '建议重点关注和监控'
        ]
      });
    });
    
    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 生成反向推理洞察
   */
  generateReverseReasoningInsights(effectNode, potentialCauses) {
    const insights = [];
    
    const topCauses = potentialCauses.slice(0, 3);
    
    insights.push({
      type: 'reverse_analysis',
      title: `${effectNode.name}的潜在原因分析`,
      description: `识别出${potentialCauses.length}个可能的原因因素`,
      confidence: topCauses.length > 0 ? topCauses[0].confidence : 0,
      implications: topCauses.map(cause => 
        `${cause.cause.name} (置信度: ${(cause.confidence * 100).toFixed(1)}%)`
      )
    });
    
    return insights;
  }

  /**
   * 生成因果链描述
   */
  generateChainDescription(chain) {
    const causes = chain.map(rel => rel.cause.name);
    const finalEffect = chain[chain.length - 1].effect.name;
    
    return `${causes.join(' → ')} → ${finalEffect}`;
  }

  findMatchingNode(text, nodes) {
    // 精确匹配
    let match = nodes.find(node => node.name.toLowerCase() === text.toLowerCase());
    if (match) return match;

    // 部分匹配
    match = nodes.find(node => 
      node.name.toLowerCase().includes(text.toLowerCase()) || 
      text.toLowerCase().includes(node.name.toLowerCase())
    );
    
    return match || null;
  }

  /**
   * 分析反向因果关系
   */
  analyzeReverseCausality(causeNode, effectNode, link) {
    const relationshipType = link.type || 'related';
    const weight = link.weight || 0.5;
    
    let reasoning = '';
    switch (relationshipType) {
      case 'causes':
      case 'generates':
      case 'produces':
        reasoning = `${causeNode.name}直接产生${effectNode.name}`;
        break;
      case 'influences':
      case 'affects':
        reasoning = `${causeNode.name}影响${effectNode.name}的状态或行为`;
        break;
      case 'requires':
      case 'depends_on':
        reasoning = `${effectNode.name}的存在依赖于${causeNode.name}`;
        break;
      case 'optimizes':
      case 'improves':
        reasoning = `${causeNode.name}优化或改善${effectNode.name}`;
        break;
      default:
        reasoning = `${causeNode.name}与${effectNode.name}存在${relationshipType}关系`;
    }
    
    return reasoning;
  }

  /**
   * 计算反向因果关系置信度
   */
  calculateReverseCausalityConfidence(causeNode, effectNode, link) {
    let confidence = link.weight || 0.5;
    
    // 基于节点重要性调整置信度
    const causeImportance = causeNode.weight || 1;
    const effectImportance = effectNode.weight || 1;
    confidence *= Math.sqrt(causeImportance * effectImportance);
    
    // 基于关系类型调整置信度
    const relationshipType = link.type || 'related';
    const typeConfidenceMap = {
      'causes': 0.9,
      'generates': 0.8,
      'influences': 0.7,
      'requires': 0.8,
      'optimizes': 0.6,
      'related': 0.5
    };
    
    confidence *= (typeConfidenceMap[relationshipType] || 0.5);
    
    return Math.min(1, confidence);
  }

  /**
   * 提取结构模式
   */
  extractStructuralPattern(sourcePattern, nodes, links) {
    const patternNodes = nodes.filter(n => 
      n.id === sourcePattern.id || 
      n.name === sourcePattern.name ||
      n.category === sourcePattern.category
    );
    
    if (patternNodes.length === 0) return null;
    
    const centerNode = patternNodes[0];
    const relatedLinks = links.filter(l => 
      l.source === centerNode.id || l.target === centerNode.id
    );
    
    return {
      centerNode,
      connectionTypes: relatedLinks.map(l => l.type),
      neighborCount: relatedLinks.length,
      nodeProperties: centerNode.properties || {}
    };
  }

  /**
   * 提取节点结构
   */
  extractNodeStructure(node, nodes, links) {
    const relatedLinks = links.filter(l => 
      l.source === node.id || l.target === node.id
    );
    
    return {
      centerNode: node,
      connectionTypes: relatedLinks.map(l => l.type),
      neighborCount: relatedLinks.length,
      nodeProperties: node.properties || {}
    };
  }

  /**
   * 计算结构相似性
   */
  calculateStructuralSimilarity(sourceStructure, targetStructure) {
    if (!sourceStructure || !targetStructure) return 0;
    
    // 连接数量相似性
    const countSimilarity = 1 - Math.abs(sourceStructure.neighborCount - targetStructure.neighborCount) / 
                           Math.max(sourceStructure.neighborCount, targetStructure.neighborCount, 1);
    
    // 连接类型相似性
    const sourceTypes = new Set(sourceStructure.connectionTypes);
    const targetTypes = new Set(targetStructure.connectionTypes);
    const intersection = new Set([...sourceTypes].filter(x => targetTypes.has(x)));
    const union = new Set([...sourceTypes, ...targetTypes]);
    const typeSimilarity = intersection.size / Math.max(union.size, 1);
    
    // 综合相似性
    return (countSimilarity * 0.4 + typeSimilarity * 0.6);
  }

  /**
   * 创建概念映射
   */
  createConceptualMapping(sourceStructure, targetStructure) {
    return {
      sourceNode: sourceStructure.centerNode.name,
      targetNode: targetStructure.centerNode.name,
      sharedConnections: sourceStructure.connectionTypes.filter(type => 
        targetStructure.connectionTypes.includes(type)
      ),
      uniqueToSource: sourceStructure.connectionTypes.filter(type => 
        !targetStructure.connectionTypes.includes(type)
      ),
      uniqueToTarget: targetStructure.connectionTypes.filter(type => 
        !sourceStructure.connectionTypes.includes(type)
      )
    };
  }

  /**
   * 生成类比预测
   */
  generateAnalogicalPredictions(sourceStructure, targetStructure) {
    const predictions = [];
    const mapping = this.createConceptualMapping(sourceStructure, targetStructure);
    
    // 基于共享连接的预测
    mapping.sharedConnections.forEach(connectionType => {
      predictions.push({
        type: 'behavioral_similarity',
        prediction: `${targetStructure.centerNode.name}可能表现出与${sourceStructure.centerNode.name}类似的${connectionType}行为`,
        confidence: 0.7
      });
    });
    
    // 基于缺失连接的预测
    mapping.uniqueToSource.forEach(connectionType => {
      predictions.push({
        type: 'potential_extension',
        prediction: `${targetStructure.centerNode.name}可能发展出${connectionType}类型的关系`,
        confidence: 0.5
      });
    });
    
    return predictions;
  }
}

module.exports = AdvancedReasoningEngine;