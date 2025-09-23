import { useState } from 'react';
import { Layout, Row, Col, Typography, Space, Button, Card, Statistic, Timeline } from 'antd';
import { 
  RocketOutlined, 
  BulbOutlined, 
  ShareAltOutlined, 
  BarChartOutlined,
  PlayCircleOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import ContentInput from '../components/ContentInput/ContentInput';
import InsightCard from '../components/InsightCard/InsightCard';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph } = Typography;

export default function HomePage() {
  const [insightData, setInsightData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 处理内容提交
  const handleContentSubmit = async (contentData) => {
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('type', contentData.type);
      
      if (contentData.type === 'text') {
        formData.append('textContent', contentData.content.text);
      } else if (contentData.type === 'url') {
        formData.append('urlContent', contentData.content.url);
      } else if (contentData.type === 'file') {
        contentData.content.files.forEach(file => {
          if (file) formData.append('files', file);
        });
      }

      const response = await fetch('/api/server/content/input', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setInsightData(result.data.insightCard);
      } else {
        throw new Error(result.message || '处理失败');
      }
    } catch (error) {
      console.error('内容处理失败:', error);
      // 显示错误状态的卡片
      setInsightData({
        contentId: 'error',
        corePoints: {
          main: '内容分析失败',
          angle: '系统错误'
        },
        viralElements: {
          emotionalTrigger: '技术故障',
          cognitiveDisruption: '服务中断',
          identityAlignment: '用户体验',
          actionDriver: '重新尝试'
        },
        argumentStructure: {
          type: '错误处理',
          strength: '系统容错机制',
          weakness: error.message
        },
        viralPrediction: {
          viralScore: 0,
          targetAudience: '系统用户',
          bestChannel: '技术支持',
          riskFactor: '服务不可用'
        },
        optimizationSuggestions: [
          '检查网络连接',
          '重新尝试提交',
          '联系技术支持'
        ],
        keywords: [],
        readingTime: 1
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '64px' }}>
          <RocketOutlined style={{ fontSize: '24px', color: '#1890ff', marginRight: '12px' }} />
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            智能内容创作工作流系统
          </Title>
          <div style={{ marginLeft: 'auto' }}>
            <Space>
              <Button type="primary" icon={<PlayCircleOutlined />}>
                快速开始
              </Button>
              <Button icon={<BarChartOutlined />}>
                数据分析
              </Button>
            </Space>
          </div>
        </div>
      </Header>

      <Content style={{ padding: '20px' }}>
        <Row gutter={[24, 24]}>
          {/* 左侧：功能介绍 */}
          <Col xs={24} lg={8}>
            <Card 
              title="六步智能工作流"
              style={{ marginBottom: '20px' }}
            >
              <Timeline
                items={[
                  {
                    dot: <BulbOutlined style={{ color: '#1890ff' }} />,
                    children: <><strong>内容输入</strong><br />多模态智能捕获</>
                  },
                  {
                    dot: <BulbOutlined style={{ color: '#52c41a' }} />,
                    children: <><strong>智能分析</strong><br />AI深度洞察生成</>
                  },
                  {
                    dot: <ShareAltOutlined style={{ color: '#faad14' }} />,
                    children: <><strong>热点匹配</strong><br />实时趋势对接</>
                  },
                  {
                    dot: <ArrowRightOutlined style={{ color: '#722ed1' }} />,
                    children: <><strong>内容创作</strong><br />AI辅助写作</>
                  },
                  {
                    dot: <PlayCircleOutlined style={{ color: '#eb2f96' }} />,
                    children: <><strong>视频制作</strong><br />数字人视频生成</>
                  },
                  {
                    dot: <ShareAltOutlined style={{ color: '#13c2c2' }} />,
                    children: <><strong>平台发布</strong><br />多平台一键分发</>
                  }
                ]}
              />
            </Card>

            <Card title="今日数据概览">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="内容分析"
                    value={23}
                    suffix="篇"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="爆款预测"
                    value={8.5}
                    suffix="分"
                    precision={1}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={12} style={{ marginTop: '16px' }}>
                  <Statistic
                    title="视频生成"
                    value={12}
                    suffix="个"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={12} style={{ marginTop: '16px' }}>
                  <Statistic
                    title="成功发布"
                    value={95}
                    suffix="%"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 右侧：内容输入和结果展示 */}
          <Col xs={24} lg={16}>
            {/* 内容输入区域 */}
            <ContentInput onSubmit={handleContentSubmit} loading={loading} />
            
            {/* 洞察卡片展示区域 */}
            {(loading || insightData) && (
              <InsightCard data={insightData} loading={loading} />
            )}
          </Col>
        </Row>
      </Content>

      <Footer style={{ textAlign: 'center', background: '#f0f2f5' }}>
        <Paragraph style={{ margin: 0, color: '#666' }}>
          智能内容创作工作流系统 ©2024 - 让AI成为你的创作伙伴
        </Paragraph>
      </Footer>
    </Layout>
  );
}