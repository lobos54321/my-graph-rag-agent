const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const cheerio = require('cheerio');

const logger = require('../utils/logger');

/**
 * 处理不同类型的内容
 */
async function processContent(inputData) {
  const { type, content, metadata } = inputData;
  
  try {
    let processedData = {
      type,
      originalContent: content,
      extractedText: '',
      metadata: {
        ...metadata,
        processedAt: new Date().toISOString()
      }
    };
    
    switch (type) {
      case 'text':
        processedData.extractedText = content;
        processedData.wordCount = content.length;
        break;
        
      case 'file':
        // 合并多个文件的内容
        const allTexts = content.map(file => `\n--- ${file.filename} ---\n${file.content}`);
        processedData.extractedText = allTexts.join('\n\n');
        processedData.fileCount = content.length;
        processedData.totalSize = content.reduce((sum, file) => sum + file.size, 0);
        break;
        
      case 'url':
        processedData.extractedText = content.text;
        processedData.title = content.title;
        processedData.url = metadata.url;
        break;
        
      default:
        throw new Error(`不支持的内容类型: ${type}`);
    }
    
    // 基础文本分析
    processedData.analysis = await performBasicAnalysis(processedData.extractedText);
    
    return processedData;
    
  } catch (error) {
    logger.error('内容处理失败:', error);
    throw error;
  }
}

/**
 * 从HTML中提取纯文本内容
 */
function extractTextFromHTML(htmlContent) {
  try {
    // 移除脚本和样式标签及其内容
    let cleanText = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    
    // 移除所有HTML标签
    cleanText = cleanText.replace(/<[^>]*>/g, ' ');
    
    // 解码HTML实体
    cleanText = cleanText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&hellip;/g, '...');
    
    // 清理多余的空白字符
    cleanText = cleanText
      .replace(/\s+/g, ' ')  // 多个空格变成单个空格
      .replace(/\n\s*\n/g, '\n\n')  // 保留段落分隔
      .trim();
    
    return cleanText;
  } catch (error) {
    console.error('HTML文本提取失败:', error);
    return htmlContent; // 失败时返回原始内容
  }
}

/**
 * 从文件中提取文本
 */
async function extractTextFromFile(filePath, mimeType) {
  try {
    const buffer = await fs.readFile(filePath);
    
    switch (mimeType) {
      case 'text/plain':
        return buffer.toString('utf-8');
        
      case 'text/html':
        // 从HTML中提取纯文本内容
        const htmlContent = buffer.toString('utf-8');
        return extractTextFromHTML(htmlContent);
        
      case 'application/pdf':
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
        
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const wordResult = await mammoth.extractRawText({ buffer });
        return wordResult.value;
        
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
        // TODO: 实现OCR功能
        return '[图片内容 - OCR功能开发中]';
        
      case 'audio/mpeg':
      case 'audio/wav':
      case 'audio/mp4':
        // TODO: 实现语音转文字
        return '[音频内容 - 语音识别功能开发中]';
        
      case 'video/mp4':
      case 'video/avi':
      case 'video/quicktime':
        // TODO: 实现视频转文字
        return '[视频内容 - 视频分析功能开发中]';
        
      default:
        // 根据文件路径检查是否是HTML文件
        if (filePath && (filePath.endsWith('.html') || filePath.endsWith('.htm'))) {
          const htmlContent = buffer.toString('utf-8');
          return extractTextFromHTML(htmlContent);
        }
        throw new Error(`不支持的文件类型: ${mimeType}`);
    }
    
  } catch (error) {
    logger.error(`文件文本提取失败: ${filePath}`, error);
    throw error;
  }
}

/**
 * 获取网页内容
 */
async function fetchWebContent(url) {
  try {
    // 验证URL格式
    new URL(url);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // 提取标题
    const title = $('title').text().trim() || 
                 $('h1').first().text().trim() || 
                 '未知标题';
    
    // 移除脚本和样式标签
    $('script, style, nav, header, footer, aside, .ad, .advertisement').remove();
    
    // 提取主要内容
    let content = '';
    const contentSelectors = [
      'article',
      '.content',
      '.post-content',
      '.entry-content',
      'main',
      '.main-content',
      '#content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length && element.text().trim().length > 100) {
        content = element.text().trim();
        break;
      }
    }
    
    // 如果没有找到主要内容，提取body中的文本
    if (!content) {
      content = $('body').text().trim();
    }
    
    // 清理文本
    content = content.replace(/\s+/g, ' ').trim();
    
    return {
      title,
      text: content,
      url,
      fetchedAt: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`网页内容获取失败: ${url}`, error);
    throw new Error(`无法获取网页内容: ${error.message}`);
  }
}

/**
 * 基础文本分析
 */
async function performBasicAnalysis(text) {
  try {
    return {
      wordCount: text.length,
      paragraphCount: text.split('\n\n').length,
      sentences: text.split(/[.!?。！？]/).filter(s => s.trim().length > 0).length,
      // TODO: 添加更多分析功能
      keywords: extractKeywords(text),
      readingTime: Math.ceil(text.length / 200) // 假设每分钟200字
    };
  } catch (error) {
    logger.error('文本分析失败:', error);
    return {
      wordCount: text.length,
      error: error.message
    };
  }
}

/**
 * 提取关键词（简单版本）
 */
function extractKeywords(text) {
  // 简单的关键词提取逻辑
  const words = text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 1);
  
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // 返回出现频率最高的10个词
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

module.exports = {
  processContent,
  extractTextFromFile,
  fetchWebContent,
  performBasicAnalysis
};