import React, { useState, useCallback } from 'react';
import { Upload, Input, Button, Tabs, Card, Space, message } from 'antd';
import { 
  InboxOutlined, 
  AudioOutlined, 
  LinkOutlined, 
  FileTextOutlined,
  CloudUploadOutlined 
} from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';
import type { UploadFile } from 'antd/es/upload/interface';

const { TextArea } = Input;
const { TabPane } = Tabs;
const { Dragger } = Upload;

interface ContentInputProps {
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export default function ContentInput({ onSubmit, loading = false }: ContentInputProps) {
  const [activeTab, setActiveTab] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [audioRecording, setAudioRecording] = useState(false);

  // 拖拽上传处理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file, index) => ({
      uid: `${Date.now()}-${index}`,
      name: file.name,
      status: 'done' as const,
      originFileObj: file,
    }));
    setFileList(prev => [...prev, ...newFiles]);
    message.success(`成功添加 ${acceptedFiles.length} 个文件`);
  }, []);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.md'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
      'video/*': ['.mp4', '.avi', '.mov']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10
  });

  // 文件上传配置
  const uploadProps = {
    multiple: true,
    fileList,
    beforeUpload: () => false, // 阻止自动上传
    onChange: ({ fileList }: { fileList: UploadFile[] }) => {
      setFileList(fileList);
    },
    onRemove: (file: UploadFile) => {
      setFileList(prev => prev.filter(item => item.uid !== file.uid));
    }
  };

  // 语音录制
  const toggleAudioRecording = () => {
    if (!audioRecording) {
      // 开始录制逻辑
      setAudioRecording(true);
      message.info('开始录音...');
    } else {
      // 停止录制逻辑
      setAudioRecording(false);
      message.success('录音完成');
    }
  };

  // 提交处理
  const handleSubmit = () => {
    const data = {
      type: activeTab,
      content: {
        text: textInput,
        url: urlInput,
        files: fileList.map(file => file.originFileObj),
      },
      timestamp: new Date().toISOString(),
    };

    onSubmit(data);
  };

  // 快速模板
  const quickTemplates = [
    { label: '营销文案分析', value: '请分析这篇营销文案的核心论点和说服策略...' },
    { label: '竞品研究', value: '请深度分析竞品的优势和策略...' },
    { label: '用户反馈整理', value: '请整理和分析用户反馈中的关键洞察...' },
    { label: '行业报告解读', value: '请提取这份行业报告的核心要点...' }
  ];

  return (
    <Card 
      title="智能内容输入" 
      className="content-input-card"
      style={{ margin: '20px 0' }}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* 文本输入 */}
        <TabPane tab={<span><FileTextOutlined />文本输入</span>} key="text">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>快速模板：</span>
                <Space wrap>
                  {quickTemplates.map((template, index) => (
                    <Button
                      key={index}
                      size="small"
                      type="dashed"
                      onClick={() => setTextInput(template.value)}
                    >
                      {template.label}
                    </Button>
                  ))}
                </Space>
              </div>
            </div>
            
            <TextArea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="输入你要分析的内容，支持 Markdown 格式..."
              rows={8}
              showCount
              maxLength={10000}
            />
          </Space>
        </TabPane>

        {/* 文件上传 */}
        <TabPane tab={<span><CloudUploadOutlined />文件上传</span>} key="file">
          <div {...getRootProps()}>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: '48px', color: isDragActive ? '#1890ff' : '#d9d9d9' }} />
              </p>
              <p className="ant-upload-text">
                {isDragActive ? '释放文件到这里' : '点击或拖拽文件到这个区域上传'}
              </p>
              <p className="ant-upload-hint">
                支持 PDF、Word、Excel、图片、音频、视频等格式，单文件最大 50MB，最多 10 个文件
              </p>
            </Dragger>
          </div>
          
          {fileList.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4>已添加文件：</h4>
              {fileList.map(file => (
                <div key={file.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span>{file.name}</span>
                  <Button size="small" danger onClick={() => setFileList(prev => prev.filter(item => item.uid !== file.uid))}>
                    移除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabPane>

        {/* URL链接 */}
        <TabPane tab={<span><LinkOutlined />网页链接</span>} key="url">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="输入要分析的网页链接..."
              prefix={<LinkOutlined />}
            />
            <div style={{ fontSize: '12px', color: '#666' }}>
              支持公众号文章、知乎回答、新闻报道等网页内容抓取分析
            </div>
          </Space>
        </TabPane>

        {/* 语音输入 */}
        <TabPane tab={<span><AudioOutlined />语音输入</span>} key="audio">
          <Space direction="vertical" style={{ width: '100%' }} size="large" align="center">
            <Button
              type={audioRecording ? "danger" : "primary"}
              size="large"
              icon={<AudioOutlined />}
              onClick={toggleAudioRecording}
              style={{ 
                borderRadius: '50%', 
                width: '80px', 
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {audioRecording ? '停止' : '录音'}
            </Button>
            <div style={{ textAlign: 'center', color: '#666' }}>
              {audioRecording ? '录音中...' : '点击开始录音，AI 会自动转换为文字并分析'}
            </div>
          </Space>
        </TabPane>
      </Tabs>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          loading={loading}
          onClick={handleSubmit}
          disabled={
            (activeTab === 'text' && !textInput.trim()) &&
            (activeTab === 'file' && fileList.length === 0) &&
            (activeTab === 'url' && !urlInput.trim())
          }
        >
          开始智能分析
        </Button>
      </div>
    </Card>
  );
}