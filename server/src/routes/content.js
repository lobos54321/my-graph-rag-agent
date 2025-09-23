const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router();
const logger = require('../utils/logger');
const { processContent, extractTextFromFile, fetchWebContent } = require('../services/contentService');
const { generateInsightCard } = require('../services/aiService');
const EnhancedScraper = require('../services/enhancedScraper');

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'text/html',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'video/mp4',
      'video/avi',
      'video/quicktime'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  }
});

// 内容输入处理
router.post('/input', upload.array('files', 10), async (req, res) => {
  try {
    const { type, textContent, urlContent } = req.body;
    const files = req.files;
    
    logger.info(`收到内容输入请求，类型: ${type}`);
    
    let processedContent = {};
    
    switch (type) {
      case 'text':
        if (!textContent) {
          return res.status(400).json({
            success: false,
            message: '文本内容不能为空'
          });
        }
        
        processedContent = await processContent({
          type: 'text',
          content: textContent,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'manual_input'
          }
        });
        break;
        
      case 'file':
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            message: '请上传至少一个文件'
          });
        }
        
        const fileContents = [];
        for (const file of files) {
          try {
            const extractedText = await extractTextFromFile(file.path, file.mimetype);
            fileContents.push({
              filename: file.originalname,
              content: extractedText,
              type: file.mimetype,
              size: file.size
            });
          } catch (error) {
            logger.error(`文件处理失败: ${file.originalname}`, error);
            // 继续处理其他文件，不中断整个流程
          }
        }
        
        processedContent = await processContent({
          type: 'file',
          content: fileContents,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'file_upload',
            fileCount: files.length
          }
        });
        break;
        
      case 'url':
        if (!urlContent) {
          return res.status(400).json({
            success: false,
            message: 'URL不能为空'
          });
        }
        
        const webContent = await fetchWebContent(urlContent);
        processedContent = await processContent({
          type: 'url',
          content: webContent,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'web_fetch',
            url: urlContent
          }
        });
        break;
        
      case 'audio':
        // 语音转文字处理
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            message: '请上传音频文件'
          });
        }
        
        // TODO: 实现语音转文字功能
        processedContent = {
          text: '语音转文字功能开发中...',
          metadata: { source: 'audio_input' }
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的内容类型'
        });
    }
    
    // 生成即时洞察卡片
    const insightCard = await generateInsightCard(processedContent);
    
    res.json({
      success: true,
      data: {
        processedContent,
        insightCard,
        contentId: `content_${Date.now()}`
      },
      message: '内容处理完成'
    });
    
  } catch (error) {
    logger.error('内容输入处理失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '内容处理失败'
    });
  } finally {
    // 清理临时文件
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (error) {
          logger.warn(`清理临时文件失败: ${file.path}`, error);
        }
      }
    }
  }
});

// 获取处理历史
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    
    // TODO: 从数据库获取历史记录
    const history = {
      items: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit)
    };
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('获取历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败'
    });
  }
});

// 删除内容
router.delete('/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    // TODO: 从数据库删除内容记录
    
    res.json({
      success: true,
      message: '内容删除成功'
    });
  } catch (error) {
    logger.error('删除内容失败:', error);
    res.status(500).json({
      success: false,
      message: '删除内容失败'
    });
  }
});

// ========== 增强网站和视频抓取功能 ==========

// 检测是否为视频URL
function isVideoUrl(url) {
  const videoPatterns = [
    /youtube\.com\/watch/,
    /youtu\.be\//,
    /bilibili\.com\/video/,
    /vimeo\.com/,
    /dailymotion\.com/,
    /tiktok\.com/
  ];
  return videoPatterns.some(pattern => pattern.test(url));
}

// 增强的Bilibili视频内容提取
function extractBilibiliContent(url, videoInfo) {
  console.log("📺 Bilibili视频内容提取...");
  
  try {
    // 多重标题提取策略
    const titleStrategies = [
      () => videoInfo.title,
      () => videoInfo.data?.title,
      () => videoInfo.data?.title_display
    ];

    let title = "未知视频";
    for (const strategy of titleStrategies) {
      const result = strategy();
      if (result && result !== "undefined" && result.trim()) {
        title = result;
        console.log(`✅ 标题提取成功: ${title}`);
        break;
      }
    }

    // 提取UP主信息
    let uploader = "未知UP主";
    if (videoInfo.data?.owner?.name) {
      uploader = videoInfo.data.owner.name;
      console.log(`✅ UP主提取成功: ${uploader}`);
    }

    // 提取描述信息
    let description = "";
    if (videoInfo.data?.desc) {
      description = videoInfo.data.desc;
      console.log(`✅ 描述提取成功: ${description.length} 字符`);
    }

    // 构建视频内容
    const combinedContent = `
视频标题: ${title}
UP主: ${uploader}
视频链接: ${url}
视频描述: ${description}
`;

    console.log(`✅ Bilibili内容提取完成:\n  - 标题: ${title}\n  - UP主: ${uploader}\n  - 播放量: ${videoInfo.data?.stat?.view || '未知'}\n  - 时长: ${videoInfo.data?.duration || '未知'}`);

    return {
      platform: "Bilibili",
      title: title,
      uploader: uploader,
      description: description,
      content: combinedContent,
      metadata: {
        url: url,
        view_count: videoInfo.data?.stat?.view,
        duration: videoInfo.data?.duration,
        pubdate: videoInfo.data?.pubdate
      }
    };

  } catch (error) {
    console.log(`❌ Bilibili内容提取失败: ${error.message}`);
    return {
      platform: "Bilibili",
      title: "提取失败",
      content: `视频链接: ${url}\n提取失败: ${error.message}`,
      error: error.message
    };
  }
}

// 视频内容提取主函数
async function extractVideoContent(url) {
  console.log(`🎬 检测到视频链接，开始提取内容: ${url}`);
  
  try {
    // 发送HTTP请求获取页面内容
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 检测平台并提取内容
    if (url.includes('bilibili.com')) {
      // 查找页面中的JSON数据
      let videoInfo = {};
      
      const scripts = $('script').toArray();
      for (const script of scripts) {
        const scriptContent = $(script).html();
        if (scriptContent && scriptContent.includes('window.__INITIAL_STATE__')) {
          try {
            const match = scriptContent.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
            if (match) {
              videoInfo = JSON.parse(match[1]);
              break;
            }
          } catch (e) {
            // 继续尝试其他方法
          }
        }
      }

      return extractBilibiliContent(url, videoInfo);
    }
    
    // 其他平台的处理
    const title = $('title').text() || "未知视频";
    return {
      platform: "Unknown",
      title: title,
      content: `视频链接: ${url}\n标题: ${title}`,
      url: url
    };

  } catch (error) {
    console.log(`❌ 视频内容提取失败: ${error.message}`);
    return {
      platform: "Unknown",
      title: "提取失败",
      content: `视频链接: ${url}\n提取失败: ${error.message}`,
      error: error.message
    };
  }
}

// GitHub专项深度内容挖掘
async function extractGitHubContent(url) {
  console.log(`🔍 检测到GitHub项目，开始深度内容挖掘...`);
  
  try {
    // 解析GitHub URL
    const urlParts = url.split('/');
    const owner = urlParts[3];
    const repo = urlParts[4];
    
    console.log(`📊 GitHub项目: ${owner}/${repo}`);

    let combinedContent = `GitHub项目分析\n项目: ${owner}/${repo}\n链接: ${url}\n\n`;

    // 获取基本项目信息
    try {
      const apiResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GraphRAG/1.0)',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });
      
      const repoData = apiResponse.data;
      combinedContent += `项目描述: ${repoData.description || '无描述'}\n`;
      combinedContent += `主要语言: ${repoData.language || '未知'}\n`;
      combinedContent += `Stars: ${repoData.stargazers_count || 0}\n`;
      combinedContent += `Forks: ${repoData.forks_count || 0}\n`;
      combinedContent += `创建时间: ${repoData.created_at}\n`;
      combinedContent += `最后更新: ${repoData.updated_at}\n\n`;
      
      console.log(`✅ 成功获取GitHub项目基本信息`);
    } catch (apiError) {
      console.log(`⚠️ GitHub API调用失败: ${apiError.message}`);
    }

    // 尝试获取README文件
    const readmeUrls = [
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.rst`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.txt`,
    ];

    for (const readmeUrl of readmeUrls) {
      try {
        console.log(`🔍 尝试获取README: ${readmeUrl}`);
        const readmeResponse = await axios.get(readmeUrl, { timeout: 5000 });
        if (readmeResponse.data && readmeResponse.data.length > 50) {
          combinedContent += `README内容:\n${readmeResponse.data}\n\n`;
          console.log(`✅ 成功获取README: ${readmeResponse.data.length} 字符`);
          break;
        }
      } catch (readmeError) {
        // 继续尝试其他README文件
      }
    }

    // 尝试获取关键配置文件
    const keyFiles = [
      'package.json', 'requirements.txt', 'setup.py', 'Cargo.toml', 'pom.xml'
    ];

    for (const fileName of keyFiles) {
      try {
        console.log(`🔍 尝试获取关键文件: https://raw.githubusercontent.com/${owner}/${repo}/master/${fileName}`);
        const fileResponse = await axios.get(`https://raw.githubusercontent.com/${owner}/${repo}/master/${fileName}`, { 
          timeout: 3000 
        });
        if (fileResponse.data && fileResponse.data.length > 10) {
          combinedContent += `${fileName}内容:\n${fileResponse.data}\n\n`;
          console.log(`✅ 成功获取关键文件: ${fileName} (${fileResponse.data.length} 字符)`);
        }
      } catch (fileError) {
        // 文件可能不存在，继续
      }
    }

    // ========== 深度子页面挖掘 ==========
    console.log(`🔍 开始深度子页面挖掘...`);
    
    // 1. 获取仓库文件目录结构并提取重要源代码文件
    try {
      const contentsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GraphRAG/1.0)',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });
      
      const files = contentsResponse.data;
      const importantFiles = files.filter(file => {
        const name = file.name.toLowerCase();
        return (name.endsWith('.py') || name.endsWith('.js') || name.endsWith('.ts') || 
                name.endsWith('.java') || name.endsWith('.cpp') || name.endsWith('.go') ||
                name.includes('main') || name.includes('index') || name.includes('app')) &&
                file.size > 100 && file.size < 50000; // 避免过大的文件
      }).slice(0, 5); // 限制最多5个文件
      
      for (const file of importantFiles) {
        try {
          console.log(`📄 获取重要源代码文件: ${file.name}`);
          const fileContent = await axios.get(file.download_url, { timeout: 3000 });
          if (fileContent.data && fileContent.data.length > 50) {
            combinedContent += `源代码文件 ${file.name}:\n${fileContent.data.substring(0, 2000)}${fileContent.data.length > 2000 ? '\n...[截断]' : ''}\n\n`;
            console.log(`✅ 成功获取源代码: ${file.name} (${fileContent.data.length} 字符)`);
          }
        } catch (e) {
          console.log(`⚠️ 获取源代码文件失败: ${file.name}`);
        }
      }
    } catch (contentsError) {
      console.log(`⚠️ 获取仓库目录失败: ${contentsError.message}`);
    }

    // 2. 获取Issues内容（最新的几个）
    try {
      console.log(`🔍 获取GitHub Issues...`);
      const issuesResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=10`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GraphRAG/1.0)',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });
      
      const issues = issuesResponse.data.slice(0, 5); // 最多5个issues
      for (const issue of issues) {
        combinedContent += `Issue #${issue.number}: ${issue.title}\n${issue.body || '无内容'}\n\n`;
        console.log(`✅ 获取Issue: #${issue.number} - ${issue.title}`);
      }
    } catch (issuesError) {
      console.log(`⚠️ 获取Issues失败: ${issuesError.message}`);
    }

    // 3. 获取Releases信息
    try {
      console.log(`🔍 获取Releases信息...`);
      const releasesResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GraphRAG/1.0)',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });
      
      const releases = releasesResponse.data.slice(0, 3); // 最多3个releases
      for (const release of releases) {
        combinedContent += `Release ${release.tag_name}: ${release.name}\n${release.body || '无发布说明'}\n\n`;
        console.log(`✅ 获取Release: ${release.tag_name} - ${release.name}`);
      }
    } catch (releasesError) {
      console.log(`⚠️ 获取Releases失败: ${releasesError.message}`);
    }

    // 4. 获取贡献者信息
    try {
      console.log(`🔍 获取贡献者信息...`);
      const contributorsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GraphRAG/1.0)',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });
      
      const contributors = contributorsResponse.data.slice(0, 5); // 最多5个贡献者
      combinedContent += `主要贡献者:\n`;
      for (const contributor of contributors) {
        combinedContent += `- ${contributor.login}: ${contributor.contributions} 次贡献\n`;
      }
      combinedContent += `\n`;
      console.log(`✅ 获取了 ${contributors.length} 个贡献者信息`);
    } catch (contributorsError) {
      console.log(`⚠️ 获取贡献者失败: ${contributorsError.message}`);
    }

    console.log(`🎯 GitHub专项深度挖掘完成，总长度: ${combinedContent.length} 字符`);
    return {
      type: "github_specialized",
      content: combinedContent,
      metadata: {
        owner,
        repo,
        url
      }
    };

  } catch (error) {
    console.log(`❌ GitHub内容挖掘失败: ${error.message}`);
    return {
      type: "github_error",
      content: `GitHub项目: ${url}\n挖掘失败: ${error.message}`,
      error: error.message
    };
  }
}

// 通用网站内容抓取 - 使用增强抓取器
async function extractWebsiteContent(url) {
  console.log(`🌐 开始增强网站抓取: ${url}`);
  
  const scraper = new EnhancedScraper();
  const result = await scraper.scrapeEnhanced(url);
  
  if (result.success) {
    // 构建增强的内容格式
    let combinedContent = `网站分析报告\n标题: ${result.title}\n链接: ${url}\n类型: ${result.siteType}\n\n`;
    
    if (result.description) {
      combinedContent += `描述: ${result.description}\n\n`;
    }
    
    // 主要内容
    combinedContent += `主要内容:\n${result.content}\n\n`;
    
    // 多媒体内容总结
    if (result.multimedia.images.length > 0) {
      combinedContent += `图片内容: 发现 ${result.multimedia.images.length} 张图片\n`;
      result.multimedia.images.slice(0, 5).forEach((img, i) => {
        combinedContent += `  ${i + 1}. ${img.alt || '无描述'} - ${img.url}\n`;
      });
      combinedContent += '\n';
    }
    
    if (result.multimedia.videos.length > 0) {
      combinedContent += `视频内容: 发现 ${result.multimedia.videos.length} 个视频\n`;
      result.multimedia.videos.slice(0, 3).forEach((video, i) => {
        combinedContent += `  ${i + 1}. ${video.title || '无标题'} - ${video.url}\n`;
      });
      combinedContent += '\n';
    }
    
    if (result.multimedia.documents.length > 0) {
      combinedContent += `文档资源: 发现 ${result.multimedia.documents.length} 个文档\n`;
      result.multimedia.documents.forEach((doc, i) => {
        combinedContent += `  ${i + 1}. ${doc.text} - ${doc.url}\n`;
      });
      combinedContent += '\n';
    }
    
    // 结构化数据
    if (result.structuredData.length > 0) {
      combinedContent += `结构化数据: 发现 ${result.structuredData.length} 个数据源\n\n`;
    }
    
    console.log(`✅ 增强网站抓取完成: ${combinedContent.length} 字符 (原内容: ${result.content.length} 字符)`);
    
    return {
      type: "enhanced_website",
      title: result.title,
      content: combinedContent,
      multimedia: result.multimedia,
      structuredData: result.structuredData,
      metadata: {
        ...result.metadata,
        siteType: result.siteType,
        enhancedExtraction: true,
        multimediaCount: {
          images: result.multimedia.images.length,
          videos: result.multimedia.videos.length,
          audio: result.multimedia.audio.length,
          documents: result.multimedia.documents.length
        }
      }
    };
  } else {
    console.log(`❌ 增强网站抓取失败，使用基础抓取: ${result.error}`);
    
    // 回退到基础抓取
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      $('script, style, nav, footer, header, aside').remove();
      
      const title = $('title').text().trim() || 'Untitled';
      let content = '';
      
      const mainSelectors = ['main', 'article', '.content', '#content', '.main', '#main'];
      for (const selector of mainSelectors) {
        const mainContent = $(selector).text().trim();
        if (mainContent && mainContent.length > content.length) {
          content = mainContent;
        }
      }
      
      if (!content) {
        content = $('body').text().trim();
      }
      
      content = content.replace(/\s+/g, ' ').trim();
      
      return {
        type: "website_fallback",
        title: title,
        content: `网站标题: ${title}\n网站链接: ${url}\n\n网站内容:\n${content}`,
        metadata: {
          url,
          title,
          contentLength: content.length,
          fallbackMode: true
        }
      };

    } catch (fallbackError) {
      return {
        type: "website_error",
        content: `网站链接: ${url}\n抓取失败: ${result.error}\n回退抓取也失败: ${fallbackError.message}`,
        error: result.error
      };
    }
  }
}

// GraphRAG分析端点 - 兼容原有前端
router.post('/graphrag/analyze', upload.single('file'), async (req, res) => {
  try {
    console.log('📄 接收到GraphRAG分析请求');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    const file = req.file;
    const filename = file.originalname;
    console.log(`📄 处理文件: ${filename}`);

    // 读取文件内容
    const fileContent = await fs.readFile(file.path, 'utf8');
    
    // 检测是否为URL内容或HTML文件
    const cleanedContent = fileContent.trim();
    let targetUrl = null;
    
    // 1. 检测纯URL文本
    if (cleanedContent.startsWith(('http://', 'https://')) && 
        cleanedContent.split().length === 1 && 
        cleanedContent.length < 500) {
      targetUrl = cleanedContent;
    }
    
    // 2. 检测HTML文件中的URL
    else if (filename.toLowerCase().endsWith('.html') || fileContent.includes('<!DOCTYPE html') || fileContent.includes('<html')) {
      console.log(`🔍 检测到HTML文件，正在提取URL...`);
      
      // 优先检测DeepWiki代理，因为它可能包含GitHub信息但需要特殊处理
      const deepwikiGithubMatch = fileContent.match(/https:\/\/deepwiki\.com\/\d+\/([^\/\s"'<>]+)/);
      if (deepwikiGithubMatch) {
        const projectName = deepwikiGithubMatch[1];
        console.log(`🔍 检测到DeepWiki代理URL: ${deepwikiGithubMatch[0]}, 项目名: ${projectName}`);
        
        // 尝试从HTML标题中提取GitHub仓库路径 - 使用更灵活的模式
        const repoOwnerMatch = fileContent.match(/github\s*-\s*([^\/]+)\/([^:]+):/i);
        if (repoOwnerMatch) {
          const owner = repoOwnerMatch[1].trim();
          const repo = repoOwnerMatch[2].trim();
          targetUrl = `https://github.com/${owner}/${repo}`;
          console.log(`✅ 从DeepWiki代理的HTML标题提取到GitHub URL: ${targetUrl}`);
        } else {
          // 查找直接的GitHub URL
          const directGithubUrlMatch = fileContent.match(/https:\/\/github\.com\/([^\/]+\/[^\/\s"'<>]+)/);
          if (directGithubUrlMatch) {
            targetUrl = directGithubUrlMatch[0];
            console.log(`✅ 从DeepWiki代理的HTML内容提取到GitHub URL: ${targetUrl}`);
          } else {
            // 尝试从内容中推断GitHub URL
            const possibleOwner = fileContent.match(new RegExp(`github\\.com/([a-zA-Z][a-zA-Z0-9-]*?)/${projectName}`, 'i')) || 
                                  fileContent.match(new RegExp(`([a-zA-Z][a-zA-Z0-9-]*?)/${projectName}(?![0-9])`));
            if (possibleOwner && !possibleOwner[1].match(/^\d+$/)) {
              targetUrl = `https://github.com/${possibleOwner[1]}/${projectName}`;
              console.log(`✅ 从DeepWiki代理推断GitHub URL: ${targetUrl}`);
            } else {
              console.log(`⚠️ DeepWiki代理URL无法确定GitHub仓库路径，使用原始URL: ${deepwikiGithubMatch[0]}`);
              targetUrl = deepwikiGithubMatch[0];
            }
          }
        }
      }
      // 如果不是DeepWiki，检测常规GitHub URL
      else {
        // 从HTML标题提取GitHub URL
        const githubUrlMatch = fileContent.match(/github\s*-\s*([^\/]+\/[^:]+):/i);
        if (githubUrlMatch) {
          const repoPath = githubUrlMatch[1].trim();
          targetUrl = `https://github.com/${repoPath}`;
          console.log(`✅ 从HTML标题提取到GitHub URL: ${targetUrl}`);
        } else {
          // 查找直接的GitHub URL
          const directGithubUrlMatch = fileContent.match(/https:\/\/github\.com\/([^\/]+\/[^\/\s"'<>]+)/);
          if (directGithubUrlMatch) {
            targetUrl = directGithubUrlMatch[0];
            console.log(`✅ 从HTML内容提取到GitHub URL: ${targetUrl}`);
          }
        }
      }
      
      // 检测YouTube HTML文件
      if (filename.toLowerCase().includes('youtube') || fileContent.includes('youtube.com') || fileContent.includes('YouTube')) {
        console.log(`🎬 检测到YouTube HTML文件，尝试提取视频信息...`);
        
        // 从HTML内容中提取YouTube视频URL或ID
        const youtubeUrlMatch = fileContent.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
        const youtubeIdMatch = fileContent.match(/watch\?v=([a-zA-Z0-9_-]+)/);
        
        if (youtubeUrlMatch) {
          targetUrl = youtubeUrlMatch[0];
          console.log(`✅ 从HTML内容提取到YouTube URL: ${targetUrl}`);
        } else if (youtubeIdMatch) {
          targetUrl = `https://www.youtube.com/watch?v=${youtubeIdMatch[1]}`;
          console.log(`✅ 从HTML内容构建YouTube URL: ${targetUrl}`);
        } else {
          // 如果找不到具体URL，使用HTML内容进行智能分析
          const $ = cheerio.load(fileContent);
          const title = $('title').text() || '未知视频';
          const description = $('meta[name="description"]').attr('content') || '';
          
          console.log(`🎬 YouTube HTML文件分析 - 标题: ${title}`);
          
          // 直接分析HTML内容而不是访问外部URL
          targetUrl = null; // 不设置URL，使用HTML内容直接分析
          
          // 构建YouTube内容分析结果
          const youtubeContent = `
YouTube视频分析
标题: ${title}
描述: ${description}
文件名: ${filename}
内容长度: ${fileContent.length} 字符

HTML内容摘要:
${fileContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 2000)}
`;
          
          // 清理临时文件
          await fs.unlink(file.path);
          
          // 直接返回YouTube HTML分析结果
          return res.json({
            status: "success",
            analysis: {
              content: youtubeContent,
              extraction_type: "youtube_html_analysis",
              video_info: {
                platform: "YouTube",
                title: title,
                uploader: "未知"
              },
              metadata: {
                filename,
                title,
                description,
                contentLength: fileContent.length
              },
              entities: [title, "YouTube", "视频"],
              concepts: ["YouTube", "视频分析", "HTML处理"],
              relationships: [],
              confidence: 0.7,
              ai_analysis_summary: `成功分析YouTube HTML文件，提取了${youtubeContent.length}字符内容`,
              knowledgeTreeSuggestion: "视频内容/YouTube"
            }
          });
        }
      }
      else {
        // 尝试从HTML内容中查找其他URL
        const urlMatch = fileContent.match(/https?:\/\/[^\s"'<>]+/);
        if (urlMatch) {
          targetUrl = urlMatch[0];
          console.log(`✅ 从HTML内容提取到URL: ${targetUrl}`);
        }
      }
    }
    
    if (targetUrl) {
      console.log(`🌐 开始使用增强抓取功能处理URL: ${targetUrl}`);
      
      let extractedData;
      
      // 检测URL类型并使用相应的提取方法
      if (isVideoUrl(targetUrl)) {
        extractedData = await extractVideoContent(targetUrl);
      } else if (targetUrl.includes('github.com')) {
        extractedData = await extractGitHubContent(targetUrl);
      } else {
        extractedData = await extractWebsiteContent(targetUrl);
      }
      
      // 清理临时文件
      await fs.unlink(file.path);
      
      // 🔥 关键修复：让增强抓取内容也经过GraphRAG Agent分析
      console.log(`🧠 开始GraphRAG智能分析增强内容: ${extractedData.content?.length || 0} 字符`);
      
      // 创建临时文件供GraphRAG分析
      const tempAnalysisFile = `/tmp/enhanced_content_${Date.now()}.txt`;
      await fs.writeFile(tempAnalysisFile, extractedData.content || '');
      
      try {
        // 调用GraphRAG Agent进行智能分析
        const FormData = require('form-data');
        const axios = require('axios');
        const form = new FormData();
        form.append('file', await fs.readFile(tempAnalysisFile), {
          filename: 'enhanced_content.txt',
          contentType: 'text/plain'
        });
        
        const graphragResponse = await axios.post('http://127.0.0.1:8001/api/graphrag/analyze', form, {
          headers: form.getHeaders(),
          timeout: 30000
        });
        
        if (graphragResponse.data && graphragResponse.data.analysis) {
          console.log(`✅ GraphRAG智能分析完成: ${graphragResponse.data.analysis.content?.length || 0} 字符`);
          
          // 合并增强抓取信息和GraphRAG分析结果
          return res.json({
            status: "success",
            analysis: {
              content: graphragResponse.data.analysis.content || extractedData.content,
              extraction_type: `${extractedData.type}_with_graphrag`,
              video_info: extractedData.platform ? {
                platform: extractedData.platform,
                title: extractedData.title,
                uploader: extractedData.uploader
              } : undefined,
              github_project: extractedData.metadata?.owner ? `${extractedData.metadata.owner}/${extractedData.metadata.repo}` : undefined,
              metadata: {
                ...extractedData.metadata,
                graphrag_enhanced: true
              },
              // 使用GraphRAG的智能分析结果
              entities: graphragResponse.data.analysis.entities || [],
              concepts: graphragResponse.data.analysis.concepts || [],
              relationships: graphragResponse.data.analysis.relationships || [],
              communities: graphragResponse.data.analysis.communities || [],
              confidence: graphragResponse.data.analysis.confidence || 0.9,
              ai_analysis_summary: graphragResponse.data.analysis.ai_analysis_summary || `GraphRAG智能分析${extractedData.type}内容，包含${graphragResponse.data.analysis.content?.length || 0}字符`,
              knowledgeTreeSuggestion: graphragResponse.data.analysis.knowledgeTreeSuggestion || extractedData.platform ? `视频内容/${extractedData.platform}` : "网站内容/GraphRAG增强"
            }
          });
        }
      } catch (graphragError) {
        console.log(`⚠️ GraphRAG分析失败，使用增强抓取结果: ${graphragError.message}`);
      } finally {
        // 清理临时分析文件
        try {
          await fs.unlink(tempAnalysisFile);
        } catch (e) {}
      }
      
      // 返回增强分析结果（如果GraphRAG失败的话）
      return res.json({
        status: "success",
        analysis: {
          content: extractedData.content,
          extraction_type: extractedData.type,
          video_info: extractedData.platform ? {
            platform: extractedData.platform,
            title: extractedData.title,
            uploader: extractedData.uploader
          } : undefined,
          github_project: extractedData.metadata?.owner ? `${extractedData.metadata.owner}/${extractedData.metadata.repo}` : undefined,
          metadata: extractedData.metadata,
          // 基础AI分析结果
          entities: extractedData.title ? [extractedData.title] : [],
          concepts: extractedData.platform ? [extractedData.platform, "内容提取", "AI分析"] : ["网站分析", "内容提取"],
          relationships: [],
          confidence: 0.8,
          ai_analysis_summary: `成功提取${extractedData.type}内容，包含${extractedData.content?.length || 0}字符`,
          knowledgeTreeSuggestion: extractedData.platform ? `视频内容/${extractedData.platform}` : "网站内容/增强提取"
        }
      });
    }
    
    // 普通文件处理（保持原有逻辑）
    const processedContent = await extractTextFromFile(fileContent, filename);
    
    // 清理临时文件
    await fs.unlink(file.path);
    
    return res.json({
      status: "success", 
      analysis: {
        content: processedContent,
        ai_analysis_summary: `文档处理完成，提取了${processedContent.length}字符的内容`,
        entities: ["文档", "内容"],
        concepts: ["文档处理", "内容提取"],
        relationships: [],
        confidence: 0.7,
        knowledgeTreeSuggestion: "文档管理/上传文档"
      }
    });

  } catch (error) {
    console.error('GraphRAG分析失败:', error);
    
    // 清理临时文件
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('临时文件清理失败:', unlinkError);
      }
    }
    
    res.status(500).json({
      status: "error",
      message: '分析失败',
      error: error.message
    });
  }
});

module.exports = router;