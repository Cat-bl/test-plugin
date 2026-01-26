import { AbstractTool } from './AbstractTool.js';
import fetch from 'node-fetch';

/**
 * BingImageSearch 工具类，用于搜索二次元图片
 * 数据源：Yande.re + Konachan（高清动漫壁纸站）
 */
export class BingImageSearchTool extends AbstractTool {
    constructor() {
        super();
        this.name = 'bingImageSearchTool';
        this.description = '根据关键词搜索二次元/动漫图片并返回图片 URL 列表，支持英文标签搜索效果更好（如：cat_ears, landscape, sunset）';
        this.parameters = {
            type: "object",
            properties: {
                query: {
                    type: 'string',
                    description: '搜索的图片关键词，建议使用英文标签，多个标签用空格分隔（如：cat_ears blue_eyes）'
                },
                count: {
                    type: 'number',
                    description: '返回结果数量，最多10个',
                    default: 10
                }
            },
            required: ['query', 'count']
        };
    }

    /**
     * Fisher-Yates 洗牌算法
     */
    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * 从 Booru 站点搜索图片
     * @param {string} baseUrl - API 基础 URL
     * @param {string} query - 搜索关键词
     * @param {number} count - 需要的结果数量
     * @param {string} siteName - 站点名称（用于日志）
     * @returns {Promise<Array<string>|null>} - 图片URL列表或null
     */
    async searchBooru(baseUrl, query, count, siteName) {
        try {
            // 处理搜索关键词：空格转换为+，添加safe过滤
            const tags = query.trim().replace(/\s+/g, '+') + '+rating:safe';

            // 随机页数，增加图片多样性
            const randomPage = Math.floor(Math.random() * 10) + 1;

            const url = `${baseUrl}?tags=${encodeURIComponent(tags)}&limit=${Math.min(count * 3, 100)}&page=${randomPage}`;

            console.log(`[图片搜索] ${siteName} 请求: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                },
                timeout: 15000
            });

            if (!response.ok) {
                console.error(`[图片搜索] ${siteName} HTTP错误: ${response.status}`);
                return null;
            }

            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`[图片搜索] ${siteName} 无结果`);
                return null;
            }

            // 提取图片URL，优先使用高清图
            const imageUrls = data
                .map(item => item.file_url || item.jpeg_url || item.sample_url)
                .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));

            console.log(`[图片搜索] ${siteName} 获取到 ${imageUrls.length} 张图片`);

            // 随机打乱并返回指定数量
            return this.shuffleArray(imageUrls).slice(0, count);

        } catch (error) {
            console.error(`[图片搜索] ${siteName} 错误:`, error.message);
            return null;
        }
    }

    /**
     * 从 Yande.re 搜索图片（主源）
     */
    async searchYandere(query, count) {
        return this.searchBooru('https://yande.re/post.json', query, count, 'Yande.re');
    }

    /**
     * 从 Konachan 搜索图片（备用源）
     */
    async searchKonachan(query, count) {
        return this.searchBooru('https://konachan.com/post.json', query, count, 'Konachan');
    }

    /**
     * 从 Danbooru 搜索图片（第三备用源）
     */
    async searchDanbooru(query, count) {
        try {
            const tags = query.trim().replace(/\s+/g, '+') + '+rating:general';
            const randomPage = Math.floor(Math.random() * 10) + 1;

            const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tags)}&limit=${Math.min(count * 3, 100)}&page=${randomPage}`;

            console.log(`[图片搜索] Danbooru 请求: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 15000
            });

            if (!response.ok) {
                console.error(`[图片搜索] Danbooru HTTP错误: ${response.status}`);
                return null;
            }

            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`[图片搜索] Danbooru 无结果`);
                return null;
            }

            // Danbooru 的字段名不同
            const imageUrls = data
                .map(item => item.file_url || item.large_file_url)
                .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));

            console.log(`[图片搜索] Danbooru 获取到 ${imageUrls.length} 张图片`);

            return this.shuffleArray(imageUrls).slice(0, count);

        } catch (error) {
            console.error(`[图片搜索] Danbooru 错误:`, error.message);
            return null;
        }
    }

    /**
     * Tool 执行函数
     * @param {Object} opts - 参数选项
     * @param {Object} e - 事件对象
     * @returns {Promise<string>} - 搜索结果或错误信息
     */
    async func(opts, e) {
        const { query } = opts;
        // 处理 count 参数，默认为10，限制范围1-10
        let count = opts.count !== undefined ? Math.max(1, Math.min(10, parseInt(opts.count) || 10)) : 10;

        if (!query) {
            return '搜索关键词（query）是必填项。';
        }

        console.log(`[图片搜索] 开始搜索: "${query}", 数量: ${count}`);

        let imageUrls = [];

        // 1. 首先尝试 Yande.re
        const yandereResults = await this.searchYandere(query, count);
        if (yandereResults && yandereResults.length > 0) {
            imageUrls = yandereResults;
        }

        // 2. 如果不足，尝试 Konachan 补充
        if (imageUrls.length < count) {
            const konachanResults = await this.searchKonachan(query, count - imageUrls.length);
            if (konachanResults && konachanResults.length > 0) {
                imageUrls = [...new Set([...imageUrls, ...konachanResults])];
            }
        }

        // 3. 如果还不足，尝试 Danbooru 补充
        if (imageUrls.length < count) {
            const danbooruResults = await this.searchDanbooru(query, count - imageUrls.length);
            if (danbooruResults && danbooruResults.length > 0) {
                imageUrls = [...new Set([...imageUrls, ...danbooruResults])];
            }
        }

        // 截取到目标数量
        imageUrls = imageUrls.slice(0, count);

        console.log(`[图片搜索] 最终获取 ${imageUrls.length} 张图片`);

        if (!imageUrls || imageUrls.length === 0) {
            return '抱歉，未搜索到相关图片。建议使用英文标签搜索，如：cat_ears, landscape, sunset, anime_girl 等。';
        }

        // 检查图片可用性
        async function isImageAccessible(url) {
            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    return contentType && contentType.startsWith('image/');
                }
                return false;
            } catch (error) {
                return false;
            }
        }

        // 并行检查所有图片的可用性
        const urlChecks = await Promise.allSettled(
            imageUrls.map(async url => ({
                url,
                isAccessible: await isImageAccessible(url)
            }))
        );

        // 过滤出可用的图片URL
        const validUrls = urlChecks
            .filter(result => result.status === 'fulfilled' && result.value.isAccessible)
            .map(result => result.value.url)
            .slice(0, count);

        if (validUrls.length === 0) {
            return '抱歉，未找到可用的图片，请换个关键词重试。';
        }

        // 构建图片消息
        const allimages = [];
        for (const url of validUrls) {
            try {
                const img = segment.image(url);
                allimages.push(img);
            } catch (error) {
                console.error(`构建图片消息失败 ${url}:`, error);
            }
        }

        if (allimages.length === 0) {
            return '抱歉，所有图片都无法发送，请重试。';
        }

        // 发送合并转发消息
        try {
            const list = allimages.map(img => ({
                user_id: '',
                nickname: '',
                message: img,
            }));

            await e.bot.adapter.sendGroupForwardMsg(e, list);

            return `已成功发送 ${allimages.length} 张图片~`;
        } catch (error) {
            console.error('[图片搜索] 发送失败:', error);
            return '图片发送失败，可能被风控，请稍后再试。';
        }
    }
}