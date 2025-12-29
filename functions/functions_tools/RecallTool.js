import { AbstractTool } from './AbstractTool.js';

/**
 * 消息撤回工具类，用于撤回机器人发送的消息
 * 适配napcat-onebotv11版本
 */
export class RecallTool extends AbstractTool {
  constructor() {
    super();
    this.name = 'recallTool';
    this.description = '撤回消息，当需要撤回之前发送的消息时调用此工具。可以从聊天历史记录中的[消息ID:xxx]获取message_id参数';
    this.parameters = {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: '要撤回的消息ID，可从聊天历史记录中的[消息ID:xxx]获取，不填则尝试撤回引用的消息'
        }
      }
    };
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
   * 执行撤回操作
   * @param {Object} opts - 参数选项
   * @param {Object} e - 事件对象
   * @returns {Promise<Object|string>} - 操作结果或错误信息
   */
  async func(opts, e) {
    const { message_id } = opts;

    let targetMessageId = message_id;

    // 如果没有提供message_id，尝试从引用消息获取
    if (!targetMessageId) {
      if (e.source?.message_id) {
        targetMessageId = e.source.message_id;
      } else if (e.reply_id) {
        targetMessageId = e.reply_id;
      } else if (e.source?.seq) {
        // 尝试通过seq获取message_id
        try {
          const msgInfo = await this.callApi('get_msg', { message_id: e.source.seq });
          if (msgInfo?.data?.message_id) {
            targetMessageId = msgInfo.data.message_id;
          }
        } catch (err) {
          // 忽略错误
        }
      }
    }

    if (!targetMessageId) {
      return '未指定要撤回的消息ID，请提供message_id或引用要撤回的消息';
    }

    try {
      const response = await this.callApi('delete_msg', {
        message_id: targetMessageId
      });

      if (response.status === 'ok' || response.retcode === 0) {
        return {
          action: 'recall',
          success: true,
          message_id: targetMessageId,
          message: '消息已撤回'
        };
      } else {
        return {
          action: 'recall',
          success: false,
          message_id: targetMessageId,
          error: response.message || response.wording || '撤回消息失败，可能消息已超过撤回时限或无权限撤回'
        };
      }
    } catch (error) {
      console.error('撤回消息失败:', error);
      return `撤回消息失败: ${error.message}`;
    }
  }
}
