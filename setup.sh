#!/bin/bash

echo "🚀 开始设置智能内容创作工作流系统..."

# 设置权限
echo "📁 设置文件权限..."
chmod -R 755 .
find . -name "*.sh" -exec chmod +x {} \;

# 创建必要的目录
echo "📁 创建项目目录结构..."
mkdir -p uploads temp logs server/logs

# 安装前端依赖
echo "📦 安装前端依赖..."
npm install

# 安装后端依赖
echo "📦 安装后端依赖..."
cd server && npm install && cd ..

# 复制环境配置文件
if [ ! -f .env ]; then
    echo "⚙️  创建环境配置文件..."
    cp .env.example .env
    echo "请编辑 .env 文件配置你的API密钥"
fi

# 设置git hooks (如果是git仓库)
if [ -d .git ]; then
    echo "🔧 设置Git hooks..."
    chmod +x .git/hooks/* 2>/dev/null || true
fi

echo "✅ 设置完成！"
echo ""
echo "下一步："
echo "1. 编辑 .env 文件配置API密钥"
echo "2. 运行 npm run dev 启动前端"
echo "3. 运行 npm run server 启动后端"
echo ""