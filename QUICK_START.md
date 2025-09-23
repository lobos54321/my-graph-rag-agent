# 🚀 快速开始指南

## 系统概览

**智能内容创作工作流系统** 是一个AI驱动的端到端内容创作解决方案，支持从内容输入到智能分析的完整工作流。

### 核心功能
- 📝 **多模态内容输入**：文本、文件、URL、语音
- 🤖 **AI洞察分析**：GPT-4驱动的智能内容分析
- 📊 **知识图谱可视化**：实体关系提取与交互式展示
- 📚 **智能知识库**：模板管理与搜索系统
- 🔗 **Dify平台集成**：高级内容生成 (prome.live/chat/dify)

## 环境要求

- Node.js >= 18
- npm >= 8
- PostgreSQL >= 14 (可选，开发阶段可跳过)
- Redis >= 6 (可选，开发阶段可跳过)

## 快速启动

### 1. 项目初始化
```bash
# 设置权限
chmod +x setup.sh start-dev.sh

# 运行初始化脚本
./setup.sh
```

### 2. 配置API密钥
编辑 `.env` 文件：
```bash
# AI服务配置
OPENAI_API_KEY=your_openai_api_key_here
DIFY_API_KEY=your_dify_api_key_here
DIFY_API_URL=https://prome.live/chat/dify

# 数据库配置（开发阶段可使用默认值）
DATABASE_URL=postgresql://localhost:5432/intelligent_content_db
REDIS_URL=redis://localhost:6379

# 服务器配置
PORT=3000
SERVER_PORT=3001
NODE_ENV=development
```

### 3. 启动开发服务
```bash
# 一键启动前后端服务
./start-dev.sh
```

### 4. 访问系统
- **主页面**: http://localhost:3000
- **演示页面**: http://localhost:3000/demo
- **API接口**: http://localhost:3001

## 功能演示

### 在线演示
访问 http://localhost:3000/demo 查看完整功能演示

### 手动测试
1. **内容输入测试**
   - 文本输入：输入营销文案或分析内容
   - 文件上传：上传PDF、Word文档
   - URL抓取：输入文章链接进行分析

2. **AI洞察分析**
   - 自动生成爆款要素分析
   - 传播潜力预测评分
   - 优化建议生成

3. **知识图谱**
   - 实体关系自动提取
   - 交互式图谱可视化
   - 节点详情查看

## API接口说明

### 内容分析接口
```bash
POST /api/server/content/input
Content-Type: multipart/form-data

# 参数
type: text|file|url|audio
textContent: "要分析的文本内容"
files: 上传的文件
urlContent: "https://example.com/article"
```

### 洞察生成接口
```bash
POST /api/server/insights/generate
Content-Type: application/json

{
  "text": "要分析的内容",
  "includeGraph": true
}
```

## 系统架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   前端 (React)   │    │   后端 (Node.js) │    │   AI服务集成     │
│                │    │                 │    │                │
│ • Ant Design   │◄──►│ • Express API   │◄──►│ • OpenAI GPT-4 │
│ • D3.js图表    │    │ • PostgreSQL    │    │ • Dify平台     │
│ • Redux状态    │    │ • Redis缓存     │    │ • GraphRAG算法 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 故障排除

### 常见问题

1. **权限问题**
```bash
# 修复权限
chmod -R 755 .
find . -name "*.sh" -exec chmod +x {} \;
```

2. **端口占用**
```bash
# 检查端口使用情况
lsof -ti:3000
lsof -ti:3001

# 杀死占用进程
kill -9 $(lsof -ti:3000)
```

3. **API密钥错误**
- 检查 `.env` 文件中的API密钥是否正确
- 确认OpenAI账户有足够的API额度
- 验证Dify平台连接状态

4. **依赖安装失败**
```bash
# 清理缓存重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### 日志查看
```bash
# 查看应用日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log

# 查看服务器日志
tail -f server/logs/combined.log
```

## 开发指南

### 添加新功能
1. 前端组件: `components/NewFeature/`
2. 后端路由: `server/src/routes/newfeature.js`
3. 服务逻辑: `server/src/services/newfeatureService.js`

### 数据库迁移
```bash
# 连接数据库
psql $DATABASE_URL

# 运行迁移脚本
\i server/migrations/001_initial.sql
```

### 测试
```bash
# 前端测试
npm test

# 后端测试
cd server && npm test
```

## 技术支持

- **文档**: 查看项目README.md
- **问题反馈**: GitHub Issues
- **演示视频**: /demo页面交互演示

---

**祝你使用愉快！** 🎉