import React, { useState } from 'react';
import { Layout, Card, Row, Col, Button, Space, Typography, Steps, Alert } from 'antd';
import { 
  RocketOutlined, 
  BulbOutlined, 
  ShareAltOutlined,
  PlayCircleOutlined 
} from '@ant-design/icons';
import ContentInput from '../components/ContentInput/ContentInput';
import InsightCard from '../components/InsightCard/InsightCard';
import GraphVisualization from '../components/GraphRAG/GraphVisualization';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;
const { Step } = Steps;

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [demoData, setDemoData] = useState({
    insightCard: null,
    graphData: null
  });

  // 演示数据
  const demoInsightCard = {
    contentId: 'demo_001',
    corePoints: {
      main: 'AI驱动的智能内容创作正在重塑营销行业',
      angle: '从技术创新角度解读内容营销未来'
    },
    viralElements: {
      emotionalTrigger: '焦虑+兴奋（技术变革带来的机遇恐慌）',
      cognitiveDisruption: 'AI创作 > 人工创作的认知颠覆',
      identityAlignment: '追求效率的现代营销人',
      actionDriver: '立即掌握AI工具获得竞争优势'
    },
    argumentStructure: {
      type: '趋势分析 → 案例验证 → 行动指南',
      strength: '数据充实，逻辑清晰，案例丰富',
      weakness: '可能忽略了传统创作的情感价值'
    },
    viralPrediction: {
      viralScore: 8.7,
      targetAudience: '25-40岁营销从业者，内容创作者',
      bestChannel: 'LinkedIn + 知乎 + 营销社群',
      riskFactor: '可能引起传统创作者的反对声音'
    },
    optimizationSuggestions: [
      '增加具体的ROI数据支撑论点',
      '补充人机协作的平衡观点',
      '提供更多可操作的工具推荐',
      '加强情感层面的表达'
    ],
    keywords: [
      { word: 'AI创作', count: 8 },
      { word: '营销效率', count: 6 },
      { word: '内容质量', count: 5 },
      { word: '竞争优势', count: 4 },
      { word: '技术变革', count: 3 }
    ],
    readingTime: 3
  };

  const demoGraphData = {
    nodes: [
      { id: '1', name: 'AI创作工具', type: 'entity', category: 'technology', weight: 3, properties: {} },
      { id: '2', name: '内容营销', type: 'concept', category: 'marketing', weight: 2, properties: {} },
      { id: '3', name: '效率提升', type: 'concept', category: 'benefit', weight: 2, properties: {} },
      { id: '4', name: '创作质量', type: 'concept', category: 'quality', weight: 2, properties: {} },
      { id: '5', name: '竞争优势', type: 'concept', category: 'advantage', weight: 1, properties: {} },
      { id: '6', name: '用户体验', type: 'concept', category: 'experience', weight: 1, properties: {} }
    ],
    links: [
      { source: '1', target: '2', type: 'transforms', weight: 1, properties: {} },
      { source: '1', target: '3', type: 'enables', weight: 1, properties: {} },
      { source: '1', target: '4', type: 'improves', weight: 0.8, properties: {} },
      { source: '3', target: '5', type: 'creates', weight: 0.9, properties: {} },
      { source: '2', target: '6', type: 'focuses_on', weight: 0.7, properties: {} },
      { source: '4', target: '6', type: 'influences', weight: 0.8, properties: {} }
    ]
  };

  const steps = [
    {
      title: '内容输入',
      description: '多模态智能捕获',
      icon: <BulbOutlined />
    },
    {
      title: '智能分析',
      description: 'AI洞察卡片生成',
      icon: <BulbOutlined />
    },
    {
      title: '知识图谱',
      description: '实体关系可视化',
      icon: <ShareAltOutlined />
    }
  ];

  const runDemo = async () => {
    // 模拟演示流程
    setCurrentStep(1);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setDemoData(prev => ({ ...prev, insightCard: demoInsightCard }));
    setCurrentStep(2);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setDemoData(prev => ({ ...prev, graphData: demoGraphData }));
    setCurrentStep(3);
  };

  const resetDemo = () => {
    setCurrentStep(0);
    setDemoData({ insightCard: null, graphData: null });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '64px' }}>
          <RocketOutlined style={{ fontSize: '24px', color: '#1890ff', marginRight: '12px' }} />
          <Title level={3} style={{ margin: 0, color: 'white' }}>
            智能内容创作工作流 - 功能演示
          </Title>
        </div>
      </Header>

      <Content style={{ padding: '20px' }}>
        {/* 演示说明 */}
        <Card style={{ marginBottom: '20px' }}>
          <Alert
            message="系统演示"
            description={
              <div>
                <Paragraph>
                  欢迎体验智能内容创作工作流系统！本演示展示了从内容输入到AI分析的完整流程。
                </Paragraph>
                <Paragraph>
                  <strong>当前功能：</strong>
                </Paragraph>
                <ul>
                  <li>✅ 多模态内容输入（文本、文件、URL、语音）</li>
                  <li>✅ AI洞察卡片生成（GPT-4驱动的智能分析）</li>
                  <li>✅ 知识图谱可视化（实体关系提取与展示）</li>
                  <li>✅ 智能知识库管理（模板库与搜索）</li>
                  <li>🚧 热点匹配引擎（开发中）</li>
                  <li>🚧 数字人视频生成（开发中）</li>
                  <li>🚧 多平台发布管理（开发中）</li>
                </ul>
                <Paragraph>
                  <strong>API配置：</strong> 系统支持接入 Dify 平台 (prome.live/chat/dify) 进行高级内容生成
                </Paragraph>
              </div>
            }
            type="info"
            showIcon
          />
        </Card>

        {/* 演示步骤 */}
        <Card title="演示流程" style={{ marginBottom: '20px' }}>
          <Steps current={currentStep} style={{ marginBottom: '20px' }}>
            {steps.map((step, index) => (
              <Step
                key={index}
                title={step.title}
                description={step.description}
                icon={step.icon}
              />
            ))}
          </Steps>

          <Space>
            <Button 
              type="primary" 
              icon={<PlayCircleOutlined />}
              onClick={runDemo}
              loading={currentStep > 0 && currentStep < 3}
            >
              开始演示
            </Button>
            <Button onClick={resetDemo}>重置演示</Button>
          </Space>
        </Card>

        <Row gutter={[20, 20]}>
          {/* 内容输入演示 */}
          <Col xs={24} lg={12}>
            <ContentInput 
              onSubmit={() => {}} 
              loading={currentStep === 1}
            />
          </Col>

          {/* 系统架构展示 */}
          <Col xs={24} lg={12}>
            <Card title="系统架构" style={{ height: '400px' }}>
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Title level={4}>技术栈</Title>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card size="small" title="前端">
                      <ul style={{ fontSize: '12px', textAlign: 'left' }}>
                        <li>React + TypeScript</li>
                        <li>Ant Design</li>
                        <li>D3.js 图表</li>
                        <li>Redux状态管理</li>
                      </ul>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="后端">
                      <ul style={{ fontSize: '12px', textAlign: 'left' }}>
                        <li>Node.js + Express</li>
                        <li>PostgreSQL + Redis</li>
                        <li>OpenAI GPT-4</li>
                        <li>GraphRAG算法</li>
                      </ul>
                    </Card>
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>

          {/* AI洞察卡片展示 */}
          {demoData.insightCard && (
            <Col xs={24}>
              <InsightCard data={demoData.insightCard} />
            </Col>
          )}

          {/* 知识图谱展示 */}
          {demoData.graphData && (
            <Col xs={24}>
              <GraphVisualization 
                data={demoData.graphData}
                width={800}
                height={500}
              />
            </Col>
          )}
        </Row>

        {/* 快速开始指南 */}
        <Card title="快速开始" style={{ marginTop: '20px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card size="small" title="1. 环境配置">
                <Paragraph style={{ fontSize: '12px' }}>
                  编辑 `.env` 文件配置API密钥：
                </Paragraph>
                <pre style={{ fontSize: '10px', background: '#f5f5f5', padding: '8px' }}>
{`OPENAI_API_KEY=your_key
DIFY_API_KEY=your_key
DATABASE_URL=postgresql://...`}
                </pre>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small" title="2. 启动服务">
                <Paragraph style={{ fontSize: '12px' }}>
                  运行启动脚本：
                </Paragraph>
                <pre style={{ fontSize: '10px', background: '#f5f5f5', padding: '8px' }}>
{`chmod +x start-dev.sh
./start-dev.sh`}
                </pre>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small" title="3. 访问系统">
                <Paragraph style={{ fontSize: '12px' }}>
                  浏览器访问：
                </Paragraph>
                <ul style={{ fontSize: '10px' }}>
                  <li>前端: http://localhost:3000</li>
                  <li>API: http://localhost:3001</li>
                </ul>
              </Card>
            </Col>
          </Row>
        </Card>
      </Content>
    </Layout>
  );
}