import React from 'react';
import { Card, Tag, Progress, Space, Typography, Divider, Badge, Alert } from 'antd';
import { 
  BulbOutlined, 
  TrophyOutlined, 
  UserOutlined, 
  ShareAltOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface InsightCardData {
  contentId: string;
  corePoints: {
    main: string;
    angle: string;
  };
  viralElements: {
    emotionalTrigger: string;
    cognitiveDisruption: string;
    identityAlignment: string;
    actionDriver: string;
  };
  argumentStructure: {
    type: string;
    strength: string;
    weakness: string;
  };
  viralPrediction: {
    viralScore: number;
    targetAudience: string;
    bestChannel: string;
    riskFactor: string;
  };
  optimizationSuggestions: string[];
  keywords: Array<{ word: string; count: number }>;
  readingTime: number;
}

interface InsightCardProps {
  data: InsightCardData;
  loading?: boolean;
}

export default function InsightCard({ data, loading = false }: InsightCardProps) {
  if (loading) {
    return (
      <Card loading style={{ margin: '20px 0' }}>
        <div style={{ height: '400px' }} />
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return '#52c41a';
    if (score >= 6) return '#faad14';
    return '#ff4d4f';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 8) return { text: '高传播潜力', color: 'success' };
    if (score >= 6) return { text: '中等传播潜力', color: 'warning' };
    return { text: '传播潜力待提升', color: 'error' };
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BulbOutlined style={{ color: '#1890ff' }} />
          <span>AI洞察卡片</span>
          <Badge count={`ID: ${data.contentId}`} style={{ backgroundColor: '#f0f0f0', color: '#666' }} />
        </div>
      }
      style={{ margin: '20px 0' }}
    >
      {/* 核心论点 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={4}>
          <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
          核心论点
        </Title>
        <Alert
          message={data.corePoints.main}
          description={`切入角度：${data.corePoints.angle}`}
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      </div>

      {/* 爆款要素分析 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={4}>
          <TrophyOutlined style={{ color: '#faad14', marginRight: '8px' }} />
          爆款要素分析
        </Title>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <Text strong>情绪触发：</Text>
            <Tag color="red">{data.viralElements.emotionalTrigger}</Tag>
          </div>
          <div>
            <Text strong>认知颠覆：</Text>
            <Tag color="blue">{data.viralElements.cognitiveDisruption}</Tag>
          </div>
          <div>
            <Text strong>身份认同：</Text>
            <Tag color="green">{data.viralElements.identityAlignment}</Tag>
          </div>
          <div>
            <Text strong>行动驱动：</Text>
            <Tag color="orange">{data.viralElements.actionDriver}</Tag>
          </div>
        </Space>
      </div>

      <Divider />

      {/* 传播预测 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={4}>
          <ShareAltOutlined style={{ color: '#722ed1', marginRight: '8px' }} />
          传播潜力预测
        </Title>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Text strong>爆款评分：</Text>
            <Progress
              percent={data.viralPrediction.viralScore * 10}
              strokeColor={getScoreColor(data.viralPrediction.viralScore)}
              format={() => `${data.viralPrediction.viralScore}/10`}
            />
            <Tag color={getScoreStatus(data.viralPrediction.viralScore).color}>
              {getScoreStatus(data.viralPrediction.viralScore).text}
            </Tag>
          </div>
        </div>

        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            <Text strong>目标受众：</Text>
            <Text>{data.viralPrediction.targetAudience}</Text>
          </div>
          <div>
            <ShareAltOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
            <Text strong>最佳渠道：</Text>
            <Text>{data.viralPrediction.bestChannel}</Text>
          </div>
          <div>
            <ExclamationCircleOutlined style={{ marginRight: '8px', color: '#faad14' }} />
            <Text strong>风险因素：</Text>
            <Text type="warning">{data.viralPrediction.riskFactor}</Text>
          </div>
        </Space>
      </div>

      <Divider />

      {/* 论证结构分析 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={4}>
          <QuestionCircleOutlined style={{ color: '#13c2c2', marginRight: '8px' }} />
          论证结构分析
        </Title>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <Text strong>结构类型：</Text>
            <Tag>{data.argumentStructure.type}</Tag>
          </div>
          <div>
            <Text strong>逻辑强度：</Text>
            <Text type="success">{data.argumentStructure.strength}</Text>
          </div>
          <div>
            <Text strong>薄弱环节：</Text>
            <Text type="danger">{data.argumentStructure.weakness}</Text>
          </div>
        </Space>
      </div>

      {/* 关键词云 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={4}>高频关键词</Title>
        <Space wrap>
          {data.keywords.slice(0, 8).map((keyword, index) => (
            <Tag
              key={index}
              color={index < 3 ? 'red' : index < 6 ? 'blue' : 'default'}
              style={{ fontSize: `${12 + keyword.count}px` }}
            >
              {keyword.word} ({keyword.count})
            </Tag>
          ))}
        </Space>
      </div>

      <Divider />

      {/* 优化建议 */}
      <div style={{ marginBottom: '16px' }}>
        <Title level={4}>
          <BulbOutlined style={{ color: '#fa8c16', marginRight: '8px' }} />
          优化建议
        </Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          {data.optimizationSuggestions.map((suggestion, index) => (
            <Alert
              key={index}
              message={`建议 ${index + 1}`}
              description={suggestion}
              type="warning"
              showIcon
              style={{ marginBottom: '8px' }}
            />
          ))}
        </Space>
      </div>

      {/* 元数据 */}
      <div style={{ 
        borderTop: '1px solid #f0f0f0', 
        paddingTop: '16px', 
        fontSize: '12px', 
        color: '#999' 
      }}>
        <Space>
          <span>预计阅读时间: {data.readingTime} 分钟</span>
          <span>生成时间: {new Date().toLocaleString()}</span>
        </Space>
      </div>
    </Card>
  );
}