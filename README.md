# 智能内容创作工作流系统

> AI驱动的端到端内容创作解决方案，从内容输入到发布的全流程自动化

## 🚀 核心特性

- 🤖 **智能分析**：基于GraphRAG和知识图谱的深度内容洞察
- 📝 **AI创作**：集成Dify平台的智能内容生成
- 🎬 **视频制作**：开源数字人视频自动生成
- 📊 **热点匹配**：实时监控全网热点并智能匹配
- 🚀 **一键发布**：支持多平台同步发布
- 🔄 **持续优化**：AI驱动的反馈分析和自我改进

## 📋 六步智能工作流

```
内容输入 → 智能分析 → 热点匹配 → 内容创作 → 视频制作 → 平台发布
    ↑                                                        ↓
    ← 策略优化 ← 知识库更新 ← AI分析改进 ← 发布后数据收集 ←
```

## 🛠 技术栈

### 前端
- **Framework**: Next.js + React
- **UI Library**: Ant Design
- **状态管理**: Redux Toolkit
- **图谱可视化**: D3.js + ECharts

### 后端
- **服务端**: Node.js + Express
- **数据库**: PostgreSQL + Redis + Neo4j
- **消息队列**: Socket.io
- **存储**: 本地/云存储

### AI技术
- **GraphRAG**: graph-rag-agent
- **反省系统**: mcp-think-tank
- **内容创作**: Dify平台API
- **视频生成**: 开源数字人方案

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### 安装
```bash
# 克隆项目
git clone <repository-url>
cd intelligent-content-workflow

# 安装依赖
npm run setup

# 配置环境变量
cp .env.example .env
```

### 启动项目
```bash
# 启动前端开发服务器
npm run dev

# 启动后端服务器
npm run server
```

## 📁 项目结构

```
intelligent-content-workflow/
├── components/           # React组件
├── pages/               # Next.js页面
├── store/               # Redux状态管理
├── utils/               # 工具函数
├── types/               # TypeScript类型定义
├── server/              # 后端服务
│   ├── src/
│   │   ├── controllers/  # 控制器
│   │   ├── services/     # 业务逻辑
│   │   ├── models/       # 数据模型
│   │   ├── utils/        # 工具函数
│   │   └── config/       # 配置文件
└── docs/                # 文档
```

## 🎯 MVP功能

### 第一阶段：核心浓缩器 (4周)
- [x] 多模态内容输入
- [x] AI洞察卡片生成
- [x] 基础知识库管理
- [ ] 简单热点匹配

### 第二阶段：洞察引擎 (6周)
- [ ] GraphRAG集成
- [ ] 知识图谱可视化
- [ ] Dify平台对接
- [ ] 热点匹配引擎

### 第三阶段：完整闭环 (8周)
- [ ] 数字人视频生成
- [ ] 多平台发布
- [ ] 数据分析优化
- [ ] 个人情报周报

## 📊 成功指标

- **产品指标**: DAU > 10,000, 内容生成成功率 > 95%
- **技术指标**: 系统稳定性 > 99.9%, API响应 < 300ms
- **业务指标**: 用户留存率 > 60%, 内容发布增长 > 200%

## 🤝 贡献

欢迎贡献代码！请阅读 [贡献指南](CONTRIBUTING.md)

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件