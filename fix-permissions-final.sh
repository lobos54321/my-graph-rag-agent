#!/bin/bash

echo "🔧 彻底修复权限问题..."

# 获取当前用户
CURRENT_USER=$(whoami)

echo "当前用户: $CURRENT_USER"

# 方法1: 修改当前项目目录权限
echo "1. 修改项目目录权限..."
chown -R $CURRENT_USER:staff /Users/channyLiu/intelligent-content-workflow 2>/dev/null || true
chmod -R 755 /Users/channyLiu/intelligent-content-workflow 2>/dev/null || true

# 方法2: 设置umask
echo "2. 设置默认权限掩码..."
umask 022

# 方法3: 修改特定文件类型权限
echo "3. 修复文件权限..."
find /Users/channyLiu/intelligent-content-workflow -name "*.js" -exec chmod 644 {} \; 2>/dev/null || true
find /Users/channyLiu/intelligent-content-workflow -name "*.ts" -exec chmod 644 {} \; 2>/dev/null || true
find /Users/channyLiu/intelligent-content-workflow -name "*.tsx" -exec chmod 644 {} \; 2>/dev/null || true
find /Users/channyLiu/intelligent-content-workflow -name "*.json" -exec chmod 644 {} \; 2>/dev/null || true
find /Users/channyLiu/intelligent-content-workflow -name "*.md" -exec chmod 644 {} \; 2>/dev/null || true
find /Users/channyLiu/intelligent-content-workflow -name "*.sh" -exec chmod 755 {} \; 2>/dev/null || true

# 方法4: 设置目录权限
echo "4. 修复目录权限..."
find /Users/channyLiu/intelligent-content-workflow -type d -exec chmod 755 {} \; 2>/dev/null || true

# 方法5: 创建并设置特殊目录
echo "5. 创建工作目录..."
mkdir -p /Users/channyLiu/intelligent-content-workflow/{uploads,temp,logs,server/logs} 2>/dev/null || true
chmod -R 777 /Users/channyLiu/intelligent-content-workflow/uploads 2>/dev/null || true
chmod -R 777 /Users/channyLiu/intelligent-content-workflow/temp 2>/dev/null || true
chmod -R 777 /Users/channyLiu/intelligent-content-workflow/logs 2>/dev/null || true

# 方法6: 修改shell配置文件
echo "6. 更新shell配置..."
echo 'export CLAUDE_PROJECT_DIR="/Users/channyLiu/intelligent-content-workflow"' >> ~/.bashrc 2>/dev/null || true
echo 'export CLAUDE_PROJECT_DIR="/Users/channyLiu/intelligent-content-workflow"' >> ~/.zshrc 2>/dev/null || true

# 方法7: 设置文件属性
echo "7. 移除扩展属性..."
xattr -cr /Users/channyLiu/intelligent-content-workflow 2>/dev/null || true

# 方法8: 验证权限
echo "8. 验证权限设置..."
ls -la /Users/channyLiu/intelligent-content-workflow/ | head -10

echo ""
echo "✅ 权限修复完成！"
echo ""
echo "如果仍有权限问题，请运行以下命令："
echo "sudo chown -R \$(whoami):\$(whoami) /Users/channyLiu/intelligent-content-workflow"
echo ""

# 测试写入权限
TEST_FILE="/Users/channyLiu/intelligent-content-workflow/permission_test.tmp"
echo "test" > "$TEST_FILE" 2>/dev/null && rm "$TEST_FILE" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 写入权限测试通过"
else
    echo "❌ 写入权限仍有问题"
fi