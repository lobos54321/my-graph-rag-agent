const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const { chromium, firefox, webkit } = require('playwright');

/**
 * 增强的多模态网页抓取服务
 * 集成多种抓取策略和智能内容识别
 * 
 * 功能特性:
 * - langextract风格: 智能语言检测和多语言内容提取
 * - AnyCrawl风格: 深度页面爬取和动态内容处理
 * - maxun风格: 浏览器自动化和反检测机制
 */
class EnhancedScraper {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];

    // Playwright配置 (maxun风格)
    this.playwrightConfig = {
      headless: true,
      timeout: 30000,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

    // 深度抓取配置 (AnyCrawl风格)
    this.crawlConfig = {
      maxDepth: 3,
      maxPages: 50,
      respectRobots: false,
      followExternalLinks: false,
      extractPatterns: {
        text: [
          '.content', '#content', 'main', 'article',
          '.post', '.entry', '.article-body', '.story'
        ],
        titles: ['h1', 'h2', 'h3', '.title', '.headline'],
        metadata: ['meta[name]', 'meta[property]', 'meta[content]']
      }
    };

    // 语言检测配置 (langextract风格)
    this.languagePatterns = {
      zh: /[\u4e00-\u9fff]/,
      en: /[a-zA-Z]/,
      ja: /[\u3040-\u309f\u30a0-\u30ff]/,
      ko: /[\uac00-\ud7af]/,
      ar: /[\u0600-\u06ff]/,
      ru: /[\u0400-\u04ff]/
    };
  }

  /**
   * 智能网站类型检测
   */
  detectSiteType(url) {
    const domain = new URL(url).hostname.toLowerCase();
    
    if (domain.includes('github.com')) return 'github';
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) return 'youtube';
    if (domain.includes('bilibili.com')) return 'bilibili';
    if (domain.includes('twitter.com') || domain.includes('x.com')) return 'twitter';
    if (domain.includes('linkedin.com')) return 'linkedin';
    if (domain.includes('medium.com')) return 'medium';
    if (domain.includes('stackoverflow.com')) return 'stackoverflow';
    if (domain.includes('reddit.com')) return 'reddit';
    if (domain.includes('wikipedia.org')) return 'wikipedia';
    
    return 'general';
  }

  /**
   * 获取随机User-Agent
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * 增强的HTTP请求配置
   */
  getRequestConfig(url) {
    const config = {
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    };

    // 特定网站的请求头优化
    const domain = new URL(url).hostname.toLowerCase();
    if (domain.includes('github.com')) {
      config.headers['Accept'] = 'application/vnd.github.v3+json, text/html';
    }

    return config;
  }

  /**
   * 智能内容清洗
   */
  cleanContent(html, siteType) {
    const $ = cheerio.load(html);
    
    // 移除噪音元素
    $('script, style, nav, footer, header, aside, .sidebar, .advertisement, .ads, .popup, .modal').remove();
    
    let mainContent = '';
    let title = $('title').text().trim();
    let description = $('meta[name="description"]').attr('content') || '';

    // 根据网站类型优化内容提取
    switch (siteType) {
      case 'github':
        mainContent = this.extractGitHubContent($);
        break;
      case 'medium':
        mainContent = this.extractMediumContent($);
        break;
      case 'stackoverflow':
        mainContent = this.extractStackOverflowContent($);
        break;
      case 'wikipedia':
        mainContent = this.extractWikipediaContent($);
        break;
      default:
        mainContent = this.extractGeneralContent($);
    }

    return {
      title,
      description,
      content: mainContent,
      cleanedLength: mainContent.length
    };
  }

  /**
   * GitHub专门的内容提取
   */
  extractGitHubContent($) {
    let content = '';
    
    // README内容
    const readme = $('#readme, .readme, [data-target="readme-toc.content"]').text().trim();
    if (readme) content += `README:\n${readme}\n\n`;
    
    // 项目描述
    const description = $('.f4.my-3, .BorderGrid-cell p').first().text().trim();
    if (description) content += `Description: ${description}\n\n`;
    
    // 文件列表
    const files = $('.js-navigation-item .Link--primary').map((i, el) => $(el).text().trim()).get();
    if (files.length) content += `Files: ${files.join(', ')}\n\n`;
    
    // 如果没有特殊内容，提取主体
    if (!content) content = $('main, .application-main, .repository-content').text().trim();
    
    return content || $('body').text().trim();
  }

  /**
   * Medium文章提取
   */
  extractMediumContent($) {
    const article = $('article, .postArticle-content, .section-content').text().trim();
    return article || $('main, .container').text().trim();
  }

  /**
   * StackOverflow问答提取
   */
  extractStackOverflowContent($) {
    let content = '';
    
    // 问题标题
    const questionTitle = $('.question-hyperlink, h1[itemprop="name"]').text().trim();
    if (questionTitle) content += `Question: ${questionTitle}\n\n`;
    
    // 问题内容
    const questionBody = $('.js-post-body, .question .post-text').first().text().trim();
    if (questionBody) content += `Question Body: ${questionBody}\n\n`;
    
    // 答案
    $('.answer .post-text').each((i, el) => {
      const answer = $(el).text().trim();
      if (answer && i < 3) { // 最多3个答案
        content += `Answer ${i + 1}: ${answer}\n\n`;
      }
    });
    
    return content || $('main, .container').text().trim();
  }

  /**
   * Wikipedia内容提取
   */
  extractWikipediaContent($) {
    // 移除引用、编辑链接等
    $('.reference, .edit-icon, .navbox, .infobox').remove();
    
    const content = $('#mw-content-text, .mw-parser-output').text().trim();
    return content || $('main, .container').text().trim();
  }

  /**
   * 通用内容提取
   */
  extractGeneralContent($) {
    // 尝试多种主要内容选择器
    const mainSelectors = [
      'main', 'article', '.content', '#content', '.main', '#main',
      '.post-content', '.entry-content', '.article-content', '.page-content',
      '.container .row', '.wrapper', '.site-content'
    ];
    
    let content = '';
    for (const selector of mainSelectors) {
      content = $(selector).text().trim();
      if (content && content.length > 200) break;
    }
    
    // 如果没有找到主要内容，提取body但过滤短文本
    if (!content) {
      content = $('body').text().trim();
    }
    
    // 清理多余空白
    content = content.replace(/\s+/g, ' ').trim();
    
    return content;
  }

  /**
   * 多媒体内容识别
   */
  extractMultimediaContent($, url) {
    const multimedia = {
      images: [],
      videos: [],
      audio: [],
      documents: []
    };

    // 图片提取
    $('img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const alt = $(el).attr('alt');
      if (src) {
        multimedia.images.push({
          url: new URL(src, url).href,
          alt: alt || '',
          title: $(el).attr('title') || ''
        });
      }
    });

    // 视频提取
    $('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="bilibili"]').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        multimedia.videos.push({
          url: src,
          title: $(el).attr('title') || ''
        });
      }
    });

    // 音频提取
    $('audio').each((i, el) => {
      const src = $(el).attr('src') || $(el).find('source').attr('src');
      if (src) {
        multimedia.audio.push({
          url: new URL(src, url).href
        });
      }
    });

    // 文档链接提取
    $('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href$=".ppt"], a[href$=".pptx"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        multimedia.documents.push({
          url: new URL(href, url).href,
          text: $(el).text().trim()
        });
      }
    });

    return multimedia;
  }

  /**
   * 主要的增强抓取方法 - 支持多种抓取策略
   */
  async scrapeEnhanced(url, options = {}) {
    console.log(`🔍 开始增强抓取: ${url}`);
    
    try {
      const siteType = this.detectSiteType(url);
      console.log(`📍 检测到网站类型: ${siteType}`);
      
      // 根据网站类型和选项选择抓取策略
      const strategy = this.selectScrapingStrategy(siteType, options);
      console.log(`🎯 选择抓取策略: ${strategy}`);
      
      let result;
      
      switch (strategy) {
        case 'browser_automation':
          result = await this.scrapeWithBrowser(url, siteType, options);
          break;
        case 'deep_crawl':
          result = await this.deepCrawlSite(url, siteType, options);
          break;
        case 'multi_language':
          result = await this.extractMultiLanguageContent(url, siteType, options);
          break;
        default:
          result = await this.scrapeWithHTTP(url, siteType, options);
      }
      
      console.log(`✅ 增强抓取完成: ${result.metadata.contentLength} 字符`);
      return result;

    } catch (error) {
      console.error(`❌ 增强抓取失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        url,
        metadata: {
          extractionTime: new Date().toISOString(),
          failed: true
        }
      };
    }
  }

  /**
   * 选择最佳抓取策略
   */
  selectScrapingStrategy(siteType, options = {}) {
    // 强制指定策略
    if (options.strategy) return options.strategy;
    
    // SPA或需要JavaScript渲染的网站
    const jsRequiredSites = ['github', 'medium', 'twitter', 'linkedin'];
    if (jsRequiredSites.includes(siteType) || options.requiresJS) {
      return 'browser_automation';
    }
    
    // 需要深度抓取的网站
    if (options.depth > 1 || siteType === 'documentation') {
      return 'deep_crawl';
    }
    
    // 多语言网站
    if (options.multiLanguage || siteType === 'international') {
      return 'multi_language';
    }
    
    // 默认HTTP抓取
    return 'http_static';
  }

  /**
   * 浏览器自动化抓取 (maxun风格)
   */
  async scrapeWithBrowser(url, siteType, options = {}) {
    console.log(`🎭 启动浏览器自动化抓取: ${url}`);
    
    let browser = null;
    let page = null;
    
    try {
      // 选择浏览器引擎
      const browserEngine = options.browser || 'chromium';
      browser = await this.launchBrowser(browserEngine);
      page = await browser.newPage();
      
      // 配置页面
      await this.configurePage(page, options);
      
      // 导航到页面
      console.log(`🚀 导航到: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.playwrightConfig.timeout
      });
      
      // 等待动态内容加载
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      } else {
        await page.waitForTimeout(2000); // 默认等待2秒
      }
      
      // 执行自定义脚本（如滚动加载更多内容）
      if (options.executeScript || this.needsScrolling(siteType)) {
        await this.executePageScripts(page, siteType, options);
      }
      
      // 提取页面内容
      const content = await this.extractPageContent(page, siteType, url);
      
      // 截图（可选）
      if (options.screenshot) {
        const screenshotPath = `/tmp/screenshot_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        content.screenshot = screenshotPath;
      }
      
      return {
        success: true,
        siteType,
        extractionMethod: 'browser_automation',
        ...content,
        metadata: {
          url,
          contentLength: content.content?.length || 0,
          extractionTime: new Date().toISOString(),
          siteType,
          browserEngine,
          renderTime: await page.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart)
        }
      };
      
    } catch (error) {
      console.error(`❌ 浏览器抓取失败: ${error.message}`);
      throw error;
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  /**
   * 深度爬取网站 (AnyCrawl风格)
   */
  async deepCrawlSite(url, siteType, options = {}) {
    console.log(`🕷️ 开始深度爬取: ${url}`);
    
    const crawlResults = {
      mainPage: null,
      subPages: [],
      siteMap: [],
      totalContent: ''
    };
    
    try {
      // 抓取主页面
      console.log(`📄 抓取主页面...`);
      crawlResults.mainPage = await this.scrapeWithHTTP(url, siteType, options);
      crawlResults.totalContent += crawlResults.mainPage.content || '';
      
      // 发现相关链接
      const links = await this.discoverLinks(url, crawlResults.mainPage.content || '', siteType);
      console.log(`🔗 发现 ${links.length} 个相关链接`);
      
      // 根据配置限制爬取深度和数量
      const maxDepth = Math.min(options.maxDepth || this.crawlConfig.maxDepth, 3);
      const maxPages = Math.min(options.maxPages || this.crawlConfig.maxPages, 20);
      
      // 按优先级排序链接
      const prioritizedLinks = this.prioritizeLinks(links, siteType, url);
      
      // 爬取子页面
      let pageCount = 0;
      for (const link of prioritizedLinks.slice(0, maxPages)) {
        if (pageCount >= maxPages) break;
        
        try {
          console.log(`📑 抓取子页面 ${pageCount + 1}/${maxPages}: ${link.url}`);
          const subPageResult = await this.scrapeWithHTTP(link.url, siteType, {
            ...options,
            isSubPage: true,
            parentUrl: url
          });
          
          if (subPageResult.success && subPageResult.content) {
            crawlResults.subPages.push({
              url: link.url,
              title: subPageResult.title,
              content: subPageResult.content,
              priority: link.priority,
              type: link.type
            });
            crawlResults.totalContent += '\n\n' + subPageResult.content;
            pageCount++;
          }
          
          // 爬取间隔，避免被封
          await this.sleep(500);
          
        } catch (error) {
          console.warn(`⚠️ 子页面抓取失败 ${link.url}: ${error.message}`);
        }
      }
      
      // 构建站点地图
      crawlResults.siteMap = this.buildSiteMap(crawlResults, url);
      
      console.log(`✅ 深度爬取完成: 主页面 + ${crawlResults.subPages.length} 个子页面`);
      
      return {
        success: true,
        siteType,
        extractionMethod: 'deep_crawl',
        title: crawlResults.mainPage?.title || 'Deep Crawl Result',
        description: crawlResults.mainPage?.description || '',
        content: crawlResults.totalContent,
        subPages: crawlResults.subPages,
        siteMap: crawlResults.siteMap,
        multimedia: this.aggregateMultimedia(crawlResults),
        structuredData: this.aggregateStructuredData(crawlResults),
        metadata: {
          url,
          contentLength: crawlResults.totalContent.length,
          extractionTime: new Date().toISOString(),
          siteType,
          pagesCount: crawlResults.subPages.length + 1,
          crawlDepth: maxDepth
        }
      };
      
    } catch (error) {
      console.error(`❌ 深度爬取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 多语言内容提取 (langextract风格)
   */
  async extractMultiLanguageContent(url, siteType, options = {}) {
    console.log(`🌍 开始多语言内容提取: ${url}`);
    
    try {
      // 首先进行标准抓取
      const baseResult = await this.scrapeWithHTTP(url, siteType, options);
      
      if (!baseResult.success) {
        throw new Error('基础抓取失败');
      }
      
      const content = baseResult.content || '';
      
      // 语言检测
      const detectedLanguages = this.detectLanguages(content);
      console.log(`🔍 检测到语言: ${Object.keys(detectedLanguages).join(', ')}`);
      
      // 按语言分离内容
      const languageContent = this.separateLanguageContent(content, detectedLanguages);
      
      // 为每种语言优化内容提取
      const optimizedContent = {};
      for (const [lang, langContent] of Object.entries(languageContent)) {
        optimizedContent[lang] = this.optimizeLanguageContent(langContent, lang, siteType);
      }
      
      // 构建多语言结果
      const multiLangResult = {
        success: true,
        siteType,
        extractionMethod: 'multi_language',
        title: baseResult.title,
        description: baseResult.description,
        content: this.mergeLanguageContent(optimizedContent),
        languages: detectedLanguages,
        languageContent: optimizedContent,
        multimedia: baseResult.multimedia,
        structuredData: baseResult.structuredData,
        metadata: {
          ...baseResult.metadata,
          contentLength: content.length,
          detectedLanguages: Object.keys(detectedLanguages),
          primaryLanguage: this.getPrimaryLanguage(detectedLanguages),
          languageDistribution: detectedLanguages
        }
      };
      
      console.log(`✅ 多语言提取完成: ${Object.keys(detectedLanguages).length} 种语言`);
      return multiLangResult;
      
    } catch (error) {
      console.error(`❌ 多语言提取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * HTTP静态抓取 (优化版原方法)
   */
  async scrapeWithHTTP(url, siteType, options = {}) {
    const config = this.getRequestConfig(url);
    const response = await axios.get(url, config);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = response.data;
    const $ = cheerio.load(html);
    
    // 智能内容清洗
    const cleanedContent = this.cleanContent(html, siteType);
    
    // 多媒体内容提取
    const multimedia = this.extractMultimediaContent($, url);
    
    // 结构化数据提取
    const structuredData = this.extractStructuredData($);
    
    return {
      success: true,
      siteType,
      extractionMethod: 'http_static',
      title: cleanedContent.title,
      description: cleanedContent.description,
      content: cleanedContent.content,
      multimedia,
      structuredData,
      metadata: {
        url,
        contentLength: cleanedContent.cleanedLength,
        extractionTime: new Date().toISOString(),
        siteType,
        responseStatus: response.status
      }
    };
  }

  /**
   * 结构化数据提取（JSON-LD, Schema.org等）
   */
  extractStructuredData($) {
    const structuredData = [];
    
    // JSON-LD数据
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        structuredData.push(data);
      } catch (e) {
        // 忽略解析错误
      }
    });
    
    // Meta标签数据
    const metaData = {};
    $('meta[property], meta[name]').each((i, el) => {
      const property = $(el).attr('property') || $(el).attr('name');
      const content = $(el).attr('content');
      if (property && content) {
        metaData[property] = content;
      }
    });
    
    if (Object.keys(metaData).length > 0) {
      structuredData.push({ metaData });
    }
    
    return structuredData;
  }

  /**
   * 启动浏览器
   */
  async launchBrowser(engine = 'chromium') {
    const browsers = { chromium, firefox, webkit };
    const browserLauncher = browsers[engine] || chromium;
    
    return await browserLauncher.launch({
      ...this.playwrightConfig,
      args: [...this.playwrightConfig.args]
    });
  }

  /**
   * 配置页面
   */
  async configurePage(page, options = {}) {
    // 设置视口
    await page.setViewportSize(this.playwrightConfig.viewport);
    
    // 设置用户代理
    await page.setUserAgent(this.getRandomUserAgent());
    
    // 拦截不需要的资源（提高速度）
    if (options.blockResources) {
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }
    
    // 设置额外的请求头
    if (options.headers) {
      await page.setExtraHTTPHeaders(options.headers);
    }
  }

  /**
   * 判断是否需要滚动加载
   */
  needsScrolling(siteType) {
    const scrollingSites = ['twitter', 'linkedin', 'medium', 'reddit'];
    return scrollingSites.includes(siteType);
  }

  /**
   * 执行页面脚本
   */
  async executePageScripts(page, siteType, options = {}) {
    // 滚动加载更多内容
    if (this.needsScrolling(siteType) || options.scrollToLoad) {
      await this.autoScroll(page);
    }
    
    // 点击"加载更多"按钮
    if (options.loadMoreSelector) {
      try {
        const loadMoreButton = await page.$(options.loadMoreSelector);
        if (loadMoreButton) {
          await loadMoreButton.click();
          await page.waitForTimeout(2000);
        }
      } catch (error) {
        console.warn('加载更多按钮点击失败:', error.message);
      }
    }
    
    // 执行自定义脚本
    if (options.customScript) {
      try {
        await page.evaluate(options.customScript);
      } catch (error) {
        console.warn('自定义脚本执行失败:', error.message);
      }
    }
  }

  /**
   * 自动滚动页面
   */
  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  /**
   * 提取页面内容
   */
  async extractPageContent(page, siteType, url) {
    // 获取页面HTML
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // 获取页面标题
    const title = await page.title();
    
    // 获取meta描述
    const description = await page.$eval('meta[name="description"]', 
      el => el.getAttribute('content')
    ).catch(() => '');
    
    // 智能内容提取（结合浏览器和Cheerio）
    const content = await this.extractBrowserContent(page, $, siteType);
    
    // 提取多媒体内容
    const multimedia = this.extractMultimediaContent($, url);
    
    // 提取结构化数据
    const structuredData = this.extractStructuredData($);
    
    return {
      title,
      description,
      content,
      multimedia,
      structuredData
    };
  }

  /**
   * 浏览器环境下的内容提取
   */
  async extractBrowserContent(page, $, siteType) {
    let content = '';
    
    try {
      // 根据网站类型使用不同的提取策略
      switch (siteType) {
        case 'github':
          content = await this.extractGitHubBrowserContent(page, $);
          break;
        case 'medium':
          content = await this.extractMediumBrowserContent(page, $);
          break;
        case 'twitter':
          content = await this.extractTwitterBrowserContent(page, $);
          break;
        default:
          content = await this.extractGeneralBrowserContent(page, $);
      }
    } catch (error) {
      console.warn('浏览器内容提取失败，使用备用方法:', error.message);
      content = this.extractGeneralContent($);
    }
    
    return content;
  }

  /**
   * GitHub浏览器内容提取
   */
  async extractGitHubBrowserContent(page, $) {
    let content = '';
    
    // 等待README加载
    try {
      await page.waitForSelector('#readme', { timeout: 5000 });
    } catch (e) {
      // README可能不存在
    }
    
    // 提取README内容
    const readme = $('#readme').text().trim();
    if (readme) content += `README:\n${readme}\n\n`;
    
    // 提取项目描述
    const description = $('.f4.my-3, .BorderGrid-cell p').first().text().trim();
    if (description) content += `Description: ${description}\n\n`;
    
    // 提取文件列表
    const files = $('.js-navigation-item .Link--primary').map((i, el) => $(el).text().trim()).get();
    if (files.length) content += `Files: ${files.join(', ')}\n\n`;
    
    return content || $('main, .application-main, .repository-content').text().trim();
  }

  /**
   * Medium浏览器内容提取
   */
  async extractMediumBrowserContent(page, $) {
    // 等待文章内容加载
    try {
      await page.waitForSelector('article', { timeout: 5000 });
    } catch (e) {
      // 文章可能结构不同
    }
    
    return $('article, .postArticle-content, .section-content').text().trim() || 
           $('main, .container').text().trim();
  }

  /**
   * Twitter浏览器内容提取
   */
  async extractTwitterBrowserContent(page, $) {
    // 等待推文加载
    try {
      await page.waitForSelector('[data-testid="tweet"]', { timeout: 5000 });
    } catch (e) {
      // 推文可能还在加载
    }
    
    const tweets = [];
    $('[data-testid="tweet"]').each((i, el) => {
      const tweetText = $(el).text().trim();
      if (tweetText && i < 10) { // 最多10条推文
        tweets.push(tweetText);
      }
    });
    
    return tweets.join('\n\n');
  }

  /**
   * 通用浏览器内容提取
   */
  async extractGeneralBrowserContent(page, $) {
    // 尝试等待主要内容加载
    const selectors = ['main', 'article', '.content', '#content'];
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        break;
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }
    
    return this.extractGeneralContent($);
  }

  /**
   * 发现相关链接
   */
  async discoverLinks(baseUrl, content, siteType) {
    const $ = cheerio.load(content);
    const links = [];
    const baseUrlObj = new URL(baseUrl);
    
    $('a[href]').each((i, el) => {
      try {
        const href = $(el).attr('href');
        const linkText = $(el).text().trim();
        
        if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
        
        const absoluteUrl = new URL(href, baseUrl).href;
        const linkUrlObj = new URL(absoluteUrl);
        
        // 只处理同域名的链接
        if (linkUrlObj.hostname !== baseUrlObj.hostname) return;
        
        // 根据网站类型和链接特征确定优先级
        const priority = this.calculateLinkPriority(absoluteUrl, linkText, siteType);
        
        if (priority > 0) {
          links.push({
            url: absoluteUrl,
            text: linkText,
            priority,
            type: this.classifyLinkType(absoluteUrl, linkText, siteType)
          });
        }
      } catch (error) {
        // 忽略无效的URL
      }
    });
    
    return links;
  }

  /**
   * 计算链接优先级
   */
  calculateLinkPriority(url, text, siteType) {
    let priority = 1;
    
    // 根据网站类型调整优先级
    if (siteType === 'documentation') {
      if (url.includes('/docs/') || url.includes('/guide/')) priority += 2;
      if (text.includes('guide') || text.includes('tutorial')) priority += 1;
    }
    
    if (siteType === 'github') {
      if (url.includes('/issues/') || url.includes('/wiki/')) priority += 1;
      if (url.includes('/blob/') && url.includes('.md')) priority += 2;
    }
    
    // 根据文本内容调整优先级
    const importantKeywords = ['documentation', 'guide', 'tutorial', 'example', 'api'];
    if (importantKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      priority += 1;
    }
    
    return priority;
  }

  /**
   * 分类链接类型
   */
  classifyLinkType(url, text, siteType) {
    if (url.includes('/docs/') || url.includes('/documentation/')) return 'documentation';
    if (url.includes('/api/')) return 'api';
    if (url.includes('/example/') || url.includes('/demo/')) return 'example';
    if (url.includes('/tutorial/') || url.includes('/guide/')) return 'tutorial';
    
    return 'content';
  }

  /**
   * 按优先级排序链接
   */
  prioritizeLinks(links, siteType, baseUrl) {
    return links
      .filter(link => link.priority > 0)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.crawlConfig.maxPages);
  }

  /**
   * 构建站点地图
   */
  buildSiteMap(crawlResults, baseUrl) {
    const siteMap = {
      baseUrl,
      mainPage: {
        title: crawlResults.mainPage?.title || 'Main Page',
        url: baseUrl
      },
      subPages: crawlResults.subPages.map(page => ({
        title: page.title,
        url: page.url,
        type: page.type,
        priority: page.priority
      })),
      totalPages: crawlResults.subPages.length + 1,
      crawlTime: new Date().toISOString()
    };
    
    return siteMap;
  }

  /**
   * 聚合多媒体内容
   */
  aggregateMultimedia(crawlResults) {
    const aggregated = {
      images: [],
      videos: [],
      audio: [],
      documents: []
    };
    
    // 聚合主页面多媒体内容
    if (crawlResults.mainPage?.multimedia) {
      Object.keys(aggregated).forEach(key => {
        aggregated[key].push(...(crawlResults.mainPage.multimedia[key] || []));
      });
    }
    
    // 聚合子页面多媒体内容
    crawlResults.subPages.forEach(page => {
      if (page.multimedia) {
        Object.keys(aggregated).forEach(key => {
          aggregated[key].push(...(page.multimedia[key] || []));
        });
      }
    });
    
    return aggregated;
  }

  /**
   * 聚合结构化数据
   */
  aggregateStructuredData(crawlResults) {
    const aggregated = [];
    
    if (crawlResults.mainPage?.structuredData) {
      aggregated.push(...crawlResults.mainPage.structuredData);
    }
    
    crawlResults.subPages.forEach(page => {
      if (page.structuredData) {
        aggregated.push(...page.structuredData);
      }
    });
    
    return aggregated;
  }

  /**
   * 检测文本中的语言
   */
  detectLanguages(text) {
    const languages = {};
    let totalChars = 0;
    
    Object.entries(this.languagePatterns).forEach(([lang, pattern]) => {
      const matches = text.match(pattern) || [];
      const charCount = matches.join('').length;
      if (charCount > 0) {
        languages[lang] = charCount;
        totalChars += charCount;
      }
    });
    
    // 计算语言比例
    Object.keys(languages).forEach(lang => {
      languages[lang] = languages[lang] / totalChars;
    });
    
    return languages;
  }

  /**
   * 按语言分离内容
   */
  separateLanguageContent(text, detectedLanguages) {
    const languageContent = {};
    
    Object.keys(detectedLanguages).forEach(lang => {
      const pattern = this.languagePatterns[lang];
      const matches = text.match(new RegExp(pattern.source, 'g')) || [];
      languageContent[lang] = matches.join(' ');
    });
    
    return languageContent;
  }

  /**
   * 优化特定语言的内容
   */
  optimizeLanguageContent(content, language, siteType) {
    let optimized = content;
    
    switch (language) {
      case 'zh':
        // 中文优化：移除英文片段，保留中文内容
        optimized = content.replace(/[a-zA-Z]{3,}/g, ' ').replace(/\s+/g, ' ').trim();
        break;
      case 'en':
        // 英文优化：移除中文字符，保留英文内容
        optimized = content.replace(/[\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
        break;
      case 'ja':
        // 日文优化：保留日文字符
        optimized = content.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
        break;
    }
    
    return optimized;
  }

  /**
   * 合并多语言内容
   */
  mergeLanguageContent(languageContent) {
    let merged = '';
    
    Object.entries(languageContent).forEach(([lang, content]) => {
      if (content.trim()) {
        merged += `\n\n=== ${lang.toUpperCase()} Content ===\n${content}`;
      }
    });
    
    return merged.trim();
  }

  /**
   * 获取主要语言
   */
  getPrimaryLanguage(detectedLanguages) {
    return Object.entries(detectedLanguages)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
  }

  /**
   * 延迟执行
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = EnhancedScraper;