# 后端 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 设置 Playwright 环境变量
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 复制后端文件
COPY package*.json ./
COPY src/ ./src/

# 安装依赖
RUN npm install --production

# 创建必要目录
RUN mkdir -p uploads logs

# 启动应用
EXPOSE 8000
CMD ["npm", "start"]