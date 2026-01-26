import { AbstractTool } from './AbstractTool.js';
import fetch from 'node-fetch';
import crypto from 'crypto';

/**
 * BingImageSearch 工具类，用于搜索 Bing 图片
 */
export class BingImageSearchTool extends AbstractTool {
    constructor() {
        super();
        this.name = 'bingImageSearchTool';
        this.description = '根据关键词搜索图片并返回图片 URL 列表';
        this.parameters = {
            type: "object",
            properties: {
                query: {
                    type: 'string',
                    description: '搜索的图片关键词'
                },
                count: {
                    type: 'number',
                    description: '返回结果数量,最多10个',
                    default: 10
                }
            },
            required: ['query', 'count']
        };
    }

    /**
     * 生成请求所需的签名和headers
     * @returns {Promise<Object>} 请求头对象
     */
    async buildHeaders() {
        const gecSignature = crypto.randomBytes(32).toString('hex').toUpperCase();
        const clientData = Buffer.from(JSON.stringify({
            "1": "2",
            "2": "1",
            "3": "0",
            "4": Date.now().toString(),
            "6": "stable",
            "7": Math.floor(Math.random() * 9999999999999),
            "9": "desktop"
        })).toString('base64');

        return {
            'accept': '*/*',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-ms-gec': gecSignature,
            'sec-ms-gec-version': '1-131.0.2903.112',
            'x-client-data': clientData,
            'x-edge-shopping-flag': '1',
            'Referer': 'https://cn.bing.com/visualsearch',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
    }

    /**
     * 执行 Bing 图片搜索
     * @param {string} query - 搜索关键词
     * @param {number} count - 返回结果数量，范围1-10
     * @returns {Promise<Array<string>|null>} - 图片URL列表或null
     */
    async searchImages(query, count = 10) {
        // 限制返回数量范围为1-10
        count = Math.max(1, Math.min(10, count));

        try {
            const url = new URL('https://cn.bing.com/images/vsasync');
            url.searchParams.set('q', query);
            url.searchParams.set('count', count);

            let imageUrls = [];
            let retryCount = 0;
            const maxRetries = 3;

            while (imageUrls.length < count && retryCount < maxRetries) {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: await this.buildHeaders()
                });

                if (!response.ok) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    // 添加延迟后重试
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const data = await response.json();

                // 提取图片URL
                imageUrls = data.results
                    .map(item => item.imageUrl)
                    .filter(url => url);

                // 如果获取的图片不足，增加重试次数
                if (imageUrls.length < count) {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 如果获取的图片不足count张，通过重复已有图片来补足
            while (imageUrls.length < count) {
                imageUrls = imageUrls.concat(imageUrls.slice(0, count - imageUrls.length));
            }

            // Fisher-Yates 洗牌算法
            const shuffleArray = (array) => {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };

            // 生成随机数
            const getRandomInt = (min, max) => {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };

            // 进行多次随机打乱
            const shuffleCount = getRandomInt(3, 5);
            for (let i = 0; i < shuffleCount; i++) {
                shuffleArray(imageUrls);
                imageUrls.sort(() => Math.random() - 0.5);
                if (Math.random() > 0.5) {
                    imageUrls.reverse();
                }
                if (Math.random() > 0.5) {
                    const splitIndex = Math.floor(imageUrls.length / 2);
                    const firstHalf = imageUrls.slice(0, splitIndex);
                    const secondHalf = imageUrls.slice(splitIndex);
                    imageUrls = [...secondHalf, ...firstHalf];
                }
            }

            shuffleArray(imageUrls);
            return imageUrls.slice(0, count);

        } catch (error) {
            console.error('Bing图片搜索错误:', error);
            return null;
        }
    }

    /**
     * 执行壁纸搜索
     * @param {string} query - 搜索关键词
     * @param {number} numResults - 需要的结果数量
     * @returns {Promise<Array<string>|null>} - 图片URL列表或null
     */
    async searchWallpapers(query, numResults = 10) {
        try {
            const hashValue = crypto.randomBytes(32).toString('hex');
            const params = new URLSearchParams({
                product_id: 52,
                version_code: 28103,
                page: 0,
                search_word: query,
                maxWidth: 99999,
                minWidth: 0,
                maxHeight: 99999,
                minHeight: 0,
                searchMode: "ACCURATE_SEARCH",
                sort: 0,
                sign: hashValue
            });

            const response = await fetch("https://wallpaper.soutushenqi.com/v1/wallpaper/list", {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
                timeout: 10000,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.data || !Array.isArray(data.data)) {
                return null;
            }

            const imageUrls = data.data
                .filter(item => item.largeUrl && !item.largeUrl.includes('fw480'))
                .map(item => item.largeUrl);

            const uniqueUrls = [...new Set(imageUrls)];

            const shuffleArray = (array) => {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };

            const getRandomInt = (min, max) => {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };

            const shuffleCount = getRandomInt(3, 5);
            let results = [...uniqueUrls];

            for (let i = 0; i < shuffleCount; i++) {
                shuffleArray(results);
                results.sort(() => Math.random() - 0.5);
                if (Math.random() > 0.5) {
                    results.reverse();
                }
                if (Math.random() > 0.5) {
                    const splitIndex = Math.floor(results.length / 2);
                    const firstHalf = results.slice(0, splitIndex);
                    const secondHalf = results.slice(splitIndex);
                    results = [...secondHalf, ...firstHalf];
                }
            }

            shuffleArray(results);
            return results.slice(0, numResults);

        } catch (error) {
            console.error('壁纸搜索错误:', error);
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

        let imageUrls = await this.searchWallpapers(query, count);

        // 如果壁纸搜索完全失败，切换到 Bing 搜索
        if (!imageUrls || imageUrls.length === 0) {
            console.log('壁纸搜索无结果，切换到 Bing 搜索');
            imageUrls = await this.searchImages(query, count);
        }
        // 如果壁纸搜索结果不足，使用 Bing 搜索补充
        else if (imageUrls.length < count) {
            console.log(`壁纸搜索结果不足(${imageUrls.length}/${count})，使用 Bing 搜索补充`);
            const remainingCount = count - imageUrls.length;
            const bingResults = await this.searchImages(query, remainingCount);

            if (bingResults && bingResults.length > 0) {
                imageUrls = [...new Set([...imageUrls, ...bingResults])];
                if (imageUrls.length > count) {
                    imageUrls = imageUrls.slice(0, count);
                }
            }
        }

        if (imageUrls && imageUrls.length > 0) {
            async function isImageAccessible(url) {
                try {
                    const response = await fetch(url, {
                        method: 'HEAD',
                        timeout: 3000
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

            const shuffled = imageUrls.sort(() => 0.5 - Math.random());

            const urlChecks = await Promise.allSettled(
                shuffled.map(async url => ({
                    url,
                    isAccessible: await isImageAccessible(url)
                }))
            );

            const validUrls = urlChecks
                .filter(result => result.status === 'fulfilled' && result.value.isAccessible)
                .map(result => result.value.url)
                .slice(0, count);

            if (validUrls.length === 0) {
                return '抱歉，未找到可用的图片，请重试。';
            }

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

        return '抱歉，未搜索到相关图片，请换个关键词试试。';
    }
}
