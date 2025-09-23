const neo4j = require('neo4j-driver');
const logger = require('../utils/logger');

class Neo4jGraphService {
  constructor() {
    this.driver = null;
    this.isConnected = false;
    this.connectionConfig = {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    };
  }

  /**
   * 初始化Neo4j连接
   */
  async initialize() {
    try {
      this.driver = neo4j.driver(
        this.connectionConfig.uri,
        neo4j.auth.basic(this.connectionConfig.username, this.connectionConfig.password),
        { 
          disableLosslessIntegers: true,
          maxConnectionLifetime: 30 * 60 * 1000, // 30 minutes
          maxConnectionPoolSize: 50,
          connectionTimeout: 20 * 1000, // 20 seconds
        }
      );

      // 测试连接
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      
      this.isConnected = true;
      logger.info('Neo4j连接成功建立');
      
      // 创建索引和约束
      await this.createIndexesAndConstraints();
      
    } catch (error) {
      logger.warn('Neo4j连接失败，将使用内存图谱:', {
        message: error.message,
        code: error.code,
        uri: this.connectionConfig.uri,
        username: this.connectionConfig.username
      });
      this.isConnected = false;
    }
  }

  /**
   * 创建索引和约束
   */
  async createIndexesAndConstraints() {
    const session = this.driver.session();
    
    try {
      // 创建实体唯一约束
      await session.run(`
        CREATE CONSTRAINT entity_id_unique IF NOT EXISTS 
        FOR (n:Entity) REQUIRE n.id IS UNIQUE
      `);

      // 创建实体名称索引
      await session.run(`
        CREATE INDEX entity_name_index IF NOT EXISTS 
        FOR (n:Entity) ON (n.name)
      `);

      // 创建实体类型索引
      await session.run(`
        CREATE INDEX entity_type_index IF NOT EXISTS 
        FOR (n:Entity) ON (n.type)
      `);

      // 创建关系类型索引
      await session.run(`
        CREATE INDEX relationship_type_index IF NOT EXISTS 
        FOR ()-[r:RELATED]-() ON (r.type)
      `);

      logger.info('Neo4j索引和约束创建完成');
    } catch (error) {
      logger.error('创建Neo4j索引失败:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * 存储图谱数据
   */
  async storeGraphData(graphData, graphId = null) {
    if (!this.isConnected) {
      logger.warn('Neo4j未连接，跳过图谱存储');
      return false;
    }

    const session = this.driver.session();
    
    try {
      await session.writeTransaction(async tx => {
        // 清除旧数据（如果指定了graphId）
        if (graphId) {
          await tx.run(`
            MATCH (n:Entity {graphId: $graphId})
            DETACH DELETE n
          `, { graphId });
        }

        // 批量创建节点
        if (graphData.nodes && graphData.nodes.length > 0) {
          // 预处理节点数据，将properties转换为JSON字符串
          const processedNodes = graphData.nodes.map(node => ({
            ...node,
            propertiesJson: node.properties ? JSON.stringify(node.properties) : '{}'
          }));
          
          await tx.run(`
            UNWIND $nodes AS node
            CREATE (n:Entity {
              id: node.id,
              name: node.name,
              type: node.type,
              category: node.category,
              weight: node.weight,
              propertiesJson: node.propertiesJson,
              graphId: $graphId,
              createdAt: datetime(),
              x: node.x,
              y: node.y
            })
          `, { 
            nodes: processedNodes,
            graphId: graphId || 'default'
          });
        }

        // 批量创建关系
        if (graphData.links && graphData.links.length > 0) {
          // 预处理关系数据，将properties转换为JSON字符串
          const processedLinks = graphData.links.map(link => ({
            ...link,
            propertiesJson: link.properties ? JSON.stringify(link.properties) : '{}'
          }));
          
          await tx.run(`
            UNWIND $links AS link
            MATCH (source:Entity {id: link.source, graphId: $graphId})
            MATCH (target:Entity {id: link.target, graphId: $graphId})
            CREATE (source)-[r:RELATED {
              type: link.type,
              weight: link.weight,
              propertiesJson: link.propertiesJson,
              createdAt: datetime()
            }]->(target)
          `, { 
            links: processedLinks,
            graphId: graphId || 'default'
          });
        }
      });

      logger.info(`图谱数据存储成功: ${graphData.nodes?.length || 0}个节点, ${graphData.links?.length || 0}个关系`);
      return true;
      
    } catch (error) {
      logger.error('存储图谱数据失败:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * 高性能多跳查询
   */
  async findMultiHopConnections(startId, endId, maxHops = 4, graphId = 'default') {
    if (!this.isConnected) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH path = (start:Entity {id: $startId, graphId: $graphId})
        -[*1..${maxHops}]-(end:Entity {id: $endId, graphId: $graphId})
        WHERE start <> end
        WITH path, 
             [rel in relationships(path) | rel.weight] as weights,
             length(path) as pathLength
        RETURN path, 
               pathLength,
               reduce(totalWeight = 0, weight in weights | totalWeight + weight) as totalWeight,
               reduce(totalWeight = 1, weight in weights | totalWeight * weight) as pathScore
        ORDER BY pathLength ASC, pathScore DESC
        LIMIT 10
      `, { startId, endId, graphId });

      return result.records.map(record => ({
        path: record.get('path'),
        pathLength: record.get('pathLength'),
        totalWeight: record.get('totalWeight'),
        pathScore: record.get('pathScore'),
        nodes: record.get('path').segments.map(segment => ({
          start: segment.start.properties,
          end: segment.end.properties,
          relationship: segment.relationship.properties
        }))
      }));

    } catch (error) {
      logger.error('多跳查询失败:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * 社区检测查询
   */
  async detectCommunities(graphId = 'default', algorithm = 'louvain') {
    if (!this.isConnected) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      let query;
      
      switch (algorithm) {
        case 'louvain':
          // 简化的社区检测，不依赖GDS
          query = `
            MATCH (n:Entity {graphId: $graphId})
            OPTIONAL MATCH (n)-[r:RELATED]-(m:Entity {graphId: $graphId})
            WITH n, count(r) as degree, collect(DISTINCT m.category) as neighborCategories
            WITH n.category as communityId, collect(n) as members, count(n) as size
            WHERE size >= 2
            RETURN communityId, members, size
            ORDER BY size DESC
          `;
          break;
          
        case 'labelPropagation':
          // 基于类型的简化社区检测
          query = `
            MATCH (n:Entity {graphId: $graphId})
            OPTIONAL MATCH (n)-[r:RELATED]-(m:Entity {graphId: $graphId})
            WITH n, count(r) as degree, m.type as neighborType
            WITH n.type + '_community' as communityId, collect(n) as members, count(n) as size
            WHERE size >= 2
            RETURN communityId, members, size
            ORDER BY size DESC
          `;
          break;
          
        default:
          // 简单的连通组件检测
          query = `
            MATCH (n:Entity {graphId: $graphId})
            OPTIONAL MATCH path = (n)-[r:RELATED*1..3]-(m:Entity {graphId: $graphId})
            WITH n, collect(DISTINCT m) as connected
            WITH head(collect(n.id)) as communityId, collect(n) as members, count(n) as size
            WHERE size >= 1
            RETURN communityId, members, size
            ORDER BY size DESC
          `;
      }

      const result = await session.run(query, { graphId });
      
      return result.records.map(record => ({
        communityId: record.get('communityId'),
        members: record.get('members').map(node => node.properties),
        size: record.get('size')
      }));

    } catch (error) {
      logger.error('社区检测失败:', error);
      // 如果Neo4j GDS不可用，返回空结果
      logger.warn('Neo4j Graph Data Science插件可能未安装，社区检测功能受限');
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * 中心性分析
   */
  async calculateCentrality(graphId = 'default', centralityType = 'degree') {
    if (!this.isConnected) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      let query;
      
      switch (centralityType) {
        case 'betweenness':
          // 简化的介数中心性（基于路径数量估算）
          query = `
            MATCH (n:Entity {graphId: $graphId})
            OPTIONAL MATCH path = (start:Entity {graphId: $graphId})-[*2]-(end:Entity {graphId: $graphId})
            WHERE n IN nodes(path) AND start <> end AND start <> n AND end <> n
            WITH n, count(path) as betweenness
            RETURN n, betweenness as score
            ORDER BY score DESC
            LIMIT 20
          `;
          break;
          
        case 'closeness':
          // 简化的紧密中心性（基于平均距离）
          query = `
            MATCH (n:Entity {graphId: $graphId})
            OPTIONAL MATCH path = shortestPath((n)-[*1..4]-(m:Entity {graphId: $graphId}))
            WHERE n <> m
            WITH n, avg(length(path)) as avgDistance, count(path) as reachableNodes
            WITH n, CASE WHEN avgDistance > 0 THEN 1.0/avgDistance ELSE 0 END as closeness
            RETURN n, closeness as score
            ORDER BY score DESC
            LIMIT 20
          `;
          break;
          
        case 'pagerank':
          // 简化的PageRank（基于加权入度）
          query = `
            MATCH (n:Entity {graphId: $graphId})
            OPTIONAL MATCH (m:Entity {graphId: $graphId})-[r:RELATED]->(n)
            WITH n, sum(coalesce(r.weight, 1.0)) as weightedInDegree, count(r) as inDegree
            WITH n, (0.15 + 0.85 * weightedInDegree) as pagerank
            RETURN n, pagerank as score
            ORDER BY score DESC
            LIMIT 20
          `;
          break;
          
        default: // degree centrality
          query = `
            MATCH (n:Entity {graphId: $graphId})
            OPTIONAL MATCH (n)-[r:RELATED]-()
            WITH n, count(r) as degree
            RETURN n, degree as score
            ORDER BY score DESC
            LIMIT 20
          `;
      }

      const result = await session.run(query, { graphId });
      
      return result.records.map(record => ({
        node: record.get('n').properties,
        centrality: record.get('score'),
        type: centralityType
      }));

    } catch (error) {
      logger.error('中心性分析失败:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * 语义搜索
   */
  async semanticSearch(query, graphId = 'default', limit = 10) {
    if (!this.isConnected) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      // 使用全文搜索和模糊匹配
      const result = await session.run(`
        MATCH (n:Entity {graphId: $graphId})
        WHERE n.name CONTAINS $query 
           OR n.category CONTAINS $query
           OR any(key in keys(n.properties) WHERE n.properties[key] CONTAINS $query)
        WITH n, 
             CASE 
               WHEN n.name = $query THEN 10
               WHEN n.name CONTAINS $query THEN 5
               WHEN n.category CONTAINS $query THEN 3
               ELSE 1
             END as relevanceScore
        RETURN n, relevanceScore
        ORDER BY relevanceScore DESC, n.weight DESC
        LIMIT $limit
      `, { query, graphId, limit });

      return result.records.map(record => ({
        node: record.get('n').properties,
        relevanceScore: record.get('relevanceScore')
      }));

    } catch (error) {
      logger.error('语义搜索失败:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * 获取图谱统计信息
   */
  async getGraphStatistics(graphId = 'default') {
    if (!this.isConnected) {
      return null;
    }

    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (n:Entity {graphId: $graphId})
        OPTIONAL MATCH (n)-[r:RELATED]-()
        WITH count(DISTINCT n) as nodeCount, 
             count(r) as relationshipCount,
             collect(DISTINCT n.type) as nodeTypes,
             collect(DISTINCT n.category) as categories
        RETURN nodeCount, relationshipCount, nodeTypes, categories
      `, { graphId });

      if (result.records.length > 0) {
        const record = result.records[0];
        return {
          nodeCount: record.get('nodeCount'),
          relationshipCount: record.get('relationshipCount'),
          nodeTypes: record.get('nodeTypes'),
          categories: record.get('categories'),
          density: record.get('relationshipCount') / Math.max(1, record.get('nodeCount') * (record.get('nodeCount') - 1) / 2)
        };
      }

      return null;
    } catch (error) {
      logger.error('获取图谱统计失败:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    if (this.driver) {
      await this.driver.close();
      this.isConnected = false;
      logger.info('Neo4j连接已关闭');
    }
  }
}

module.exports = Neo4jGraphService;