import React, { useState, useEffect } from 'react';
import { 
  Tree, 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Space, 
  Popconfirm, 
  Tag,
  Tooltip,
  message 
} from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  TagOutlined,
  ExportOutlined,
  ImportOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

const { TextArea } = Input;
const { Option } = Select;

interface KnowledgeNode {
  id: string;
  title: string;
  content?: string;
  type: 'folder' | 'item';
  tags: string[];
  parentId?: string;
  children?: KnowledgeNode[];
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgeTree() {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [searchValue, setSearchValue] = useState('');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 预设模板数据
  const presetTemplates = {
    '营销策略': {
      children: [
        { title: '目标受众分析', content: '用户画像、需求分析、痛点识别...' },
        { title: '竞品分析', content: '竞品优势、差异化定位、市场机会...' },
        { title: '内容策略', content: '内容类型、发布频率、传播渠道...' },
        { title: 'KPI指标', content: '转化率、留存率、传播效果...' }
      ]
    },
    '文案写作': {
      children: [
        { title: '标题公式', content: '恐惧型、好奇型、对比型、数字型...' },
        { title: '开篇技巧', content: '场景代入、数据冲击、观点颠覆...' },
        { title: '情绪触发', content: '焦虑、愤怒、共鸣、惊喜...' },
        { title: '行动召唤', content: 'CTA设计、紧迫感营造...' }
      ]
    },
    '社媒运营': {
      children: [
        { title: '平台特性', content: '小红书、抖音、微信、B站...' },
        { title: '最佳发布时间', content: '用户活跃时段分析...' },
        { title: '爆款要素', content: '话题、标签、互动技巧...' },
        { title: '危机处理', content: '负面评论、舆情应对...' }
      ]
    }
  };

  useEffect(() => {
    loadKnowledgeBase();
  }, []);

  // 加载知识库数据
  const loadKnowledgeBase = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      const mockData = [
        {
          key: '1',
          title: '营销策略模板库',
          icon: <FolderOutlined />,
          children: [
            {
              key: '1-1',
              title: '目标用户分析框架',
              icon: <FileOutlined />
            },
            {
              key: '1-2', 
              title: '竞品分析模板',
              icon: <FileOutlined />
            }
          ]
        },
        {
          key: '2',
          title: '文案写作技巧',
          icon: <FolderOutlined />,
          children: [
            {
              key: '2-1',
              title: '爆款标题公式',
              icon: <FileOutlined />
            },
            {
              key: '2-2',
              title: '情绪触发词库',
              icon: <FileOutlined />
            }
          ]
        }
      ];
      setTreeData(mockData);
    } catch (error) {
      message.error('加载知识库失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理节点选择
  const onSelect = async (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      // 模拟获取节点详情
      const mockNodeData: KnowledgeNode = {
        id: selectedKeys[0] as string,
        title: info.node.title,
        type: info.node.children ? 'folder' : 'item',
        content: '这是一个示例内容，展示了营销策略的核心要点...',
        tags: ['营销', '策略', '模板'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setSelectedNode(mockNodeData);
    }
  };

  // 添加节点
  const handleAdd = (parentKey?: string) => {
    setModalType('add');
    setModalVisible(true);
    form.resetFields();
  };

  // 编辑节点
  const handleEdit = (node: KnowledgeNode) => {
    setModalType('edit');
    setModalVisible(true);
    form.setFieldsValue({
      title: node.title,
      content: node.content,
      type: node.type,
      tags: node.tags
    });
  };

  // 删除节点
  const handleDelete = async (nodeId: string) => {
    try {
      // 模拟删除API
      message.success('删除成功');
      loadKnowledgeBase();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success(modalType === 'add' ? '添加成功' : '修改成功');
      setModalVisible(false);
      loadKnowledgeBase();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 快速导入模板
  const handleImportTemplate = async (templateKey: string) => {
    try {
      setLoading(true);
      // 模拟导入模板逻辑
      message.success(`${templateKey}模板导入成功`);
      loadKnowledgeBase();
    } catch (error) {
      message.error('导入失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索过滤
  const filterTreeNode = (node: DataNode): boolean => {
    if (!searchValue) return true;
    return node.title?.toString().toLowerCase().includes(searchValue.toLowerCase()) || false;
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: '600px' }}>
      {/* 左侧：树形结构 */}
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>智能知识库</span>
            <Space>
              <Button 
                type="primary" 
                size="small" 
                icon={<PlusOutlined />}
                onClick={() => handleAdd()}
              >
                新建
              </Button>
              <Button 
                size="small" 
                icon={<ImportOutlined />}
                onClick={() => setModalVisible(true)}
              >
                导入模板
              </Button>
            </Space>
          </div>
        }
        style={{ width: '300px', height: '100%' }}
        bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto' }}
      >
        <Space.Compact style={{ width: '100%', marginBottom: '16px' }}>
          <Input
            placeholder="搜索知识库..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            prefix={<SearchOutlined />}
          />
        </Space.Compact>

        <Tree
          showIcon
          defaultExpandAll
          treeData={treeData}
          onSelect={onSelect}
          filterTreeNode={filterTreeNode}
          style={{ background: 'transparent' }}
        />
      </Card>

      {/* 右侧：内容详情 */}
      <Card 
        title={
          selectedNode ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span>{selectedNode.title}</span>
                <div style={{ marginTop: '4px' }}>
                  {selectedNode.tags.map(tag => (
                    <Tag key={tag} size="small">{tag}</Tag>
                  ))}
                </div>
              </div>
              <Space>
                <Tooltip title="编辑">
                  <Button 
                    size="small" 
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(selectedNode)}
                  />
                </Tooltip>
                <Popconfirm
                  title="确定要删除这个节点吗？"
                  onConfirm={() => handleDelete(selectedNode.id)}
                >
                  <Tooltip title="删除">
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            </div>
          ) : '选择一个节点查看详情'
        }
        style={{ flex: 1, height: '100%' }}
        bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto' }}
      >
        {selectedNode ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <TextArea
                value={selectedNode.content}
                rows={15}
                placeholder="在这里编写或粘贴内容..."
                style={{ resize: 'none' }}
              />
            </div>
            
            <div style={{ fontSize: '12px', color: '#666', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
              <div>创建时间: {new Date(selectedNode.createdAt).toLocaleString()}</div>
              <div>更新时间: {new Date(selectedNode.updatedAt).toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#999', paddingTop: '100px' }}>
            <FolderOutlined style={{ fontSize: '64px', marginBottom: '16px' }} />
            <div>请选择左侧节点查看详情</div>
            <div style={{ marginTop: '16px' }}>
              <Button type="primary" onClick={() => handleAdd()}>
                创建第一个知识节点
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 添加/编辑模态框 */}
      <Modal
        title={modalType === 'add' ? '新建知识节点' : '编辑知识节点'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="输入节点标题" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            initialValue="item"
          >
            <Select>
              <Option value="folder">文件夹</Option>
              <Option value="item">内容项</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="内容"
          >
            <TextArea rows={8} placeholder="输入详细内容..." />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="添加标签（回车确认）"
              tokenSeparators={[',']}
            >
              <Option value="营销">营销</Option>
              <Option value="文案">文案</Option>
              <Option value="策略">策略</Option>
              <Option value="模板">模板</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {modalType === 'add' ? '添加' : '保存'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {/* 快速模板导入 */}
        {modalType === 'add' && (
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px', marginTop: '16px' }}>
            <h4>快速导入模板</h4>
            <Space wrap>
              {Object.keys(presetTemplates).map(templateKey => (
                <Button 
                  key={templateKey}
                  size="small"
                  onClick={() => handleImportTemplate(templateKey)}
                >
                  {templateKey}
                </Button>
              ))}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}