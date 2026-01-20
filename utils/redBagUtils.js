/**
 * 获取红包类型
 * @param {object} wallet - 红包数据
 * @returns {{type: string, name: string}}
 */
export function getRedBagType(wallet) {
  const redChannel = wallet.red_channel || wallet.raw?.redChannel
  const redType = wallet.red_type || wallet.raw?.redType
  const msgType = wallet.raw?.msgType

  if (redChannel === 1024) return { type: 'exclusive', name: '专属红包' }
  if (redChannel === 32) return { type: 'password', name: '口令红包' }
  if (redType === 2) return { type: 'normal', name: '普通红包' }
  if (redType === 1 && msgType === 3) return { type: 'lucky', name: '拼手气红包' }
  return { type: 'unknown', name: '红包' }
}

/**
 * 检查专属红包是否给指定用户
 * @param {object} wallet - 红包数据
 * @param {number|string} userId - 用户QQ号
 * @returns {boolean}
 */
export function isExclusiveForUser(wallet, userId) {
  const grapUin = wallet.raw?.grapUin || []
  return grapUin.includes(String(userId))
}
