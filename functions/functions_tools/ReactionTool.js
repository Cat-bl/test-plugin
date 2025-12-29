import { AbstractTool } from './AbstractTool.js';

/**
 * 表情回应工具类，用于对消息添加表情回应
 * 适配napcat-onebotv11版本
 */
export class ReactionTool extends AbstractTool {
  constructor() {
    super();
    this.name = 'reactionTool';
    this.description = '对消息添加表情回应/贴表情，当需要用表情回应某条消息时调用此工具，你可以主动调用以增加群聊氛围。可以从聊天历史记录中的[消息ID:xxx]获取message_id参数';
    this.parameters = {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: '要添加表情回应的消息ID，可从聊天历史记录中的[消息ID:xxx]获取'
        },
        count: {
          type: 'number',
          description: '贴表情的数量，默认1个，最多20个',
          default: 1
        }
      },
      required: ['message_id']
    };
  }

  /**
   * 生成随机表情ID
   * 表情ID范围：1-500 (QQ小表情) 和 127801-128563 (emoji表情)
   */
  getRandomEmojiId() {
    const range1 = { min: 1, max: 500 };
    const range2 = { min: 127801, max: 128563 };
    const range1Size = range1.max - range1.min + 1;
    const range2Size = range2.max - range2.min + 1;
    const totalSize = range1Size + range2Size;

    const randomValue = Math.floor(Math.random() * totalSize);
    return randomValue < range1Size
      ? randomValue + range1.min
      : randomValue - range1Size + range2.min;
  }

  /**
   * 调用OneBotv11 API
   */
  async callApi(action, params = {}) {
    try {
      if (typeof Bot !== 'undefined' && Bot.sendApi) {
        return await Bot.sendApi(action, params);
      } else if (typeof global.bot !== 'undefined' && global.bot.sendApi) {
        return await global.bot.sendApi(action, params);
      } else {
        throw new Error('找不到OneBotv11 API调用接口');
      }
    } catch (error) {
      console.error(`调用API ${action} 失败:`, error);
      throw error;
    }
  }

  /**
   * 执行表情回应操作
   * @param {Object} opts - 参数选项
   * @param {Object} e - 事件对象
   * @returns {Promise<Object|string>} - 操作结果或错误信息
   */
  async func(opts, e) {
    const { message_id, count = 1 } = opts;

    if (!message_id) {
      return '缺少message_id参数';
    }

    if (!e.group_id) {
      return '此功能仅支持群聊使用';
    }

    const messageId = message_id;

    if (!messageId) {
      return '未找到要回应的消息，请提供消息ID';
    }

    // 限制数量 1-20
    const emojiCount = Math.min(Math.max(1, count), 20);

    try {
      let successCount = 0;
      const usedEmojiIds = [];

      for (let i = 0; i < emojiCount; i++) {
        const emoji_id = String(this.getRandomEmojiId());
        usedEmojiIds.push(emoji_id);

        const response = await this.callApi('set_msg_emoji_like', {
          message_id: messageId,
          emoji_id: emoji_id
        });

        if (response.status === 'ok' || response.retcode === 0) {
          successCount++;
        }

        // 多个表情时添加小延迟
        if (emojiCount > 1 && i < emojiCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        action: 'reaction',
        success: successCount > 0,
        message_id: messageId,
        emoji_count: successCount,
        requested_count: emojiCount,
        message: `已对消息${messageId}贴了${successCount}个表情,你不需要特别表明你给消息贴了表情,忽略这个结果,继续说之后的事情`
      };
    } catch (error) {
      console.error('添加表情回应失败:', error);
      return `添加表情回应失败: ${error.message}`;
    }
  }
}
