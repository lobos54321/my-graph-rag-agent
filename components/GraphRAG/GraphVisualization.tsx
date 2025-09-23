import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, Slider, Select, Tag, Tooltip, Spin, Alert } from 'antd';
import { 
  ExpandOutlined, 
  CompressOutlined, 
  ReloadOutlined, 
  DownloadOutlined,
  SettingOutlined 
} from '@ant-design/icons';
import * as d3 from 'd3';

const { Option } = Select;

interface GraphNode {
  id: string;
  name: string;
  type: 'entity' | 'concept' | 'relation';
  category: string;
  weight: number;
  properties: Record<string, any>;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  weight: number;
  properties: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphVisualizationProps {
  data: GraphData;
  width?: number;
  height?: number;
  loading?: boolean;
}

export default function GraphVisualization({ 
  data, 
  width = 800, 
  height = 600,
  loading = false 
}: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [nodeFilter, setNodeFilter] = useState<string>('all');
  const [linkFilter, setLinkFilter] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nodeCategories = ['entity', 'concept', 'relation', 'all'];
  const linkTypes = ['requires', 'contains', 'relates_to', 'influences', 'all'];

  useEffect(() => {
    if (!data || loading) return;
    
    renderGraph();
  }, [data, nodeFilter, linkFilter, width, height, loading]);

  const renderGraph = () => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 过滤数据
    const filteredNodes = data.nodes.filter(node => 
      nodeFilter === 'all' || node.type === nodeFilter
    );
    
    const filteredLinks = data.links.filter(link => 
      linkFilter === 'all' || link.type === linkFilter
    );

    // 设置力导向图
    const simulation = d3.forceSimulation(filteredNodes)
      .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // 添加缩放功能
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom as any);

    const g = svg.append('g');

    // 添加箭头标记
    svg.append('defs').selectAll('marker')
      .data(['end'])
      .enter().append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    // 绘制连线
    const link = g.append('g')
      .selectAll('line')
      .data(filteredLinks)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.weight * 2))
      .attr('marker-end', 'url(#arrowhead)');

    // 绘制节点
    const node = g.append('g')
      .selectAll('circle')
      .data(filteredNodes)
      .enter().append('circle')
      .attr('r', (d: any) => Math.sqrt(d.weight) * 5 + 10)
      .attr('fill', (d: any) => getNodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any
      )
      .on('click', (event, d: any) => {
        setSelectedNode(d);
      })
      .on('mouseover', function(event, d: any) {
        // 高亮相关节点和连线
        const relatedNodes = new Set();
        const relatedLinks = new Set();

        filteredLinks.forEach((link: any) => {
          if (link.source.id === d.id || link.target.id === d.id) {
            relatedNodes.add(link.source.id);
            relatedNodes.add(link.target.id);
            relatedLinks.add(link);
          }
        });

        node.style('opacity', (n: any) => 
          relatedNodes.has(n.id) ? 1 : 0.3
        );
        
        link.style('opacity', (l: any) => 
          relatedLinks.has(l) ? 1 : 0.1
        );

        // 显示tooltip
        showTooltip(event, d);
      })
      .on('mouseout', function() {
        node.style('opacity', 1);
        link.style('opacity', 0.6);
        hideTooltip();
      });

    // 添加标签
    const label = g.append('g')
      .selectAll('text')
      .data(filteredNodes)
      .enter().append('text')
      .text((d: any) => d.name)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none');

    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y + 4);
    });
  };

  const getNodeColor = (type: string) => {
    const colors = {
      entity: '#1890ff',
      concept: '#52c41a',
      relation: '#faad14'
    };
    return colors[type as keyof typeof colors] || '#d9d9d9';
  };

  const showTooltip = (event: any, d: GraphNode) => {
    // 实现tooltip显示逻辑
  };

  const hideTooltip = () => {
    // 实现tooltip隐藏逻辑
  };

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(750).call(
      d3.zoom().transform as any,
      d3.zoomIdentity
    );
    setZoomLevel(1);
  };

  const handleExport = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge-graph.svg';
    a.click();
    
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="构建知识图谱中..." />
      </Card>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card style={{ width, height }}>
        <Alert
          message="暂无图谱数据"
          description="请先输入内容进行分析，生成知识图谱"
          type="info"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title="知识图谱可视化"
      style={{ width: isFullscreen ? '100vw' : width, height: isFullscreen ? '100vh' : height }}
      bodyStyle={{ padding: 0, height: '100%' }}
      extra={
        <Space>
          <Select
            value={nodeFilter}
            onChange={setNodeFilter}
            style={{ width: 120 }}
            size="small"
          >
            {nodeCategories.map(cat => (
              <Option key={cat} value={cat}>
                {cat === 'all' ? '全部节点' : cat}
              </Option>
            ))}
          </Select>
          
          <Select
            value={linkFilter}
            onChange={setLinkFilter}
            style={{ width: 120 }}
            size="small"
          >
            {linkTypes.map(type => (
              <Option key={type} value={type}>
                {type === 'all' ? '全部关系' : type}
              </Option>
            ))}
          </Select>

          <Tooltip title="重置视图">
            <Button size="small" icon={<ReloadOutlined />} onClick={handleReset} />
          </Tooltip>

          <Tooltip title="导出SVG">
            <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} />
          </Tooltip>

          <Tooltip title={isFullscreen ? '退出全屏' : '全屏显示'}>
            <Button 
              size="small" 
              icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={() => setIsFullscreen(!isFullscreen)}
            />
          </Tooltip>
        </Space>
      }
    >
      <div style={{ position: 'relative', height: '100%' }}>
        <svg
          ref={svgRef}
          width="100%"
          height={isFullscreen ? '100vh' : height - 80}
          style={{ background: '#fafafa' }}
        />
        
        {/* 控制面板 */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid #d9d9d9'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', marginRight: '8px' }}>缩放: {zoomLevel.toFixed(1)}x</span>
          </div>
          <Slider
            min={0.1}
            max={4}
            step={0.1}
            value={zoomLevel}
            onChange={(value) => {
              const svg = d3.select(svgRef.current);
              svg.transition().duration(300).call(
                d3.zoom().scaleTo as any,
                value
              );
            }}
            style={{ width: 120 }}
          />
        </div>

        {/* 节点详情面板 */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 250,
            background: 'white',
            padding: '16px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            border: '1px solid #d9d9d9'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <strong>{selectedNode.name}</strong>
              <Button 
                size="small" 
                type="text" 
                onClick={() => setSelectedNode(null)}
              >
                ×
              </Button>
            </div>
            
            <div style={{ marginBottom: '8px' }}>
              <Tag color={getNodeColor(selectedNode.type)}>
                {selectedNode.type}
              </Tag>
              <Tag>{selectedNode.category}</Tag>
            </div>
            
            <div style={{ fontSize: '12px', color: '#666' }}>
              <div>权重: {selectedNode.weight}</div>
              {Object.entries(selectedNode.properties).map(([key, value]) => (
                <div key={key}>
                  {key}: {String(value)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 图例 */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid #d9d9d9'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
            图例
          </div>
          <div style={{ fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                background: '#1890ff',
                marginRight: '6px' 
              }} />
              实体
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                background: '#52c41a',
                marginRight: '6px' 
              }} />
              概念
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                background: '#faad14',
                marginRight: '6px' 
              }} />
              关系
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}