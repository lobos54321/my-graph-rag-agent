#!/bin/bash

echo "🔧 修复项目权限问题..."

# 递归设置整个项目目录权限
sudo chown -R $(whoami):$(whoami) .
sudo chmod -R 755 .

# 设置具体文件权限
find . -type f -name "*.js" -exec chmod 644 {} \;
find . -type f -name "*.ts" -exec chmod 644 {} \;
find . -type f -name "*.tsx" -exec chmod 644 {} \;
find . -type f -name "*.json" -exec chmod 644 {} \;
find . -type f -name "*.md" -exec chmod 644 {} \;
find . -type f -name "*.txt" -exec chmod 644 {} \;

# 设置shell脚本权限
find . -type f -name "*.sh" -exec chmod +x {} \;

# 设置目录权限
find . -type d -exec chmod 755 {} \;

# 设置特殊目录权限
mkdir -p uploads temp logs server/logs
chmod -R 777 uploads temp logs server/logs

echo "✅ 权限修复完成！"
echo "现在可以正常使用项目了"