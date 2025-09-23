-- 智能内容创作工作流系统数据库初始化脚本

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 内容表
CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200),
    content_type VARCHAR(50),
    original_url TEXT,
    extracted_content TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 洞察卡片表
CREATE TABLE IF NOT EXISTS insights (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES contents(id),
    insight_type VARCHAR(50),
    title VARCHAR(200),
    description TEXT,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200),
    category VARCHAR(100),
    content TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 热点匹配表
CREATE TABLE IF NOT EXISTS hotspot_matches (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES contents(id),
    hotspot_title VARCHAR(200),
    match_score DECIMAL(3,2),
    trend_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 发布记录表
CREATE TABLE IF NOT EXISTS publications (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES contents(id),
    platform VARCHAR(50),
    published_url TEXT,
    status VARCHAR(20),
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_contents_user_id ON contents(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_content_id ON insights(content_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_user_id ON knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_matches_content_id ON hotspot_matches(content_id);
CREATE INDEX IF NOT EXISTS idx_publications_content_id ON publications(content_id);