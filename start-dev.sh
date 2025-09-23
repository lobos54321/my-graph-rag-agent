#!/bin/bash

echo "🚀 启动智能内容创作工作流系统..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装Node.js"
    exit 1
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ 请先安装npm"
    exit 1
fi

# 创建日志目录
mkdir -p logs server/logs uploads temp

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd server && npm install && cd ..
fi

# 设置环境变量（如果.env不存在）
if [ ! -f ".env" ]; then
    echo "⚙️ 创建环境配置文件..."
    cp .env.example .env
    echo "请编辑.env文件配置API密钥后重新运行"
    exit 1
fi

echo "🌐 启动开发服务器..."
echo ""
echo "前端地址: http://localhost:3000"
echo "后端API: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 并行启动前后端服务
npm run dev &
FRONTEND_PID=$!

sleep 2

npm run server &
BACKEND_PID=$!

# 等待服务启动
sleep 5

# 检查服务状态
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务启动成功: http://localhost:3000"
else
    echo "❌ 前端服务启动失败"
fi

if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ 后端服务启动成功: http://localhost:3001"
else
    echo "❌ 后端服务启动失败"
fi

# 优雅关闭
trap 'echo ""; echo "🛑 正在关闭服务..."; kill $FRONTEND_PID $BACKEND_PID 2>/dev/null; exit 0' INT

# 保持脚本运行
wait