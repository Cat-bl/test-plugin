### 自用插件留存
修改自y-tian-plugin，移除了多余功能，重构全局对话实现代码，新增MCP工具功能，新增部分本地工具

### 1. 安装

在Yunzai根目录下执行：

```bash
git clone --depth=1 https://github.com/Cat-bl/test-plugin plugins/test-plugin
cd plugins/test-plugin
pnpm install
```


### 首次启动时会自动创建config文件夹，请不要修改或删除config_default文件夹和里面的文件

### message.yaml文件为ai相关配置，mcp-servers.yaml文件为MCP服务相关配置


### 添加ai对话白名单
#全局方案添加白名单群组 xxx

### 删除ai对话白名单
#全局方案删除白名单群组 xxx

### 清除群聊记录
#清除群聊记录

### 重新加载mcp工具
#mcp 重载

### 列出mcp工具列表
#mcp 列表

### message.yaml文件配置
  enabled: true // 主开关，false时完全关闭ai对话功能<br>
  botName: 哈基米 // ai名字<br>
  groupHistory: true // 是否开启获取群聊历史记录，建议开启<br>
  emojiEnabled: true // 是否开启概率随机表情包发送(取机器人qq号收藏的表情包)<br>
  useTools: true // 是否开启工具调用，建议开启<br>
  replyChance: 0 // 主动触发对话概率，例0.015为1.5%概率，为0时则关闭主动触发对话<br>
  concurrentLimit: 3 // 并发数<br>
  triggerPrefixes: // 触发ai对话关键词<br>
    - 哈基米
  excludeMessageTypes: // 需要过滤掉的文件类型(默认就可以)<br>
    - file
  allowedGroups: // 群聊白名单<br>
    - "973682389"
  enableGroupWhitelist: true // 是否开启群聊白名单，建议开启避免滥用<br>
  whitelistRejectMsg: 本群未开启此功能哦~  // 当前群聊没有配置白名单时的提示词<br>
  groupMaxMessages: 100 // 最大群聊记录<br>
  groupChatMemoryDays: 1 // 群聊记录保存日期<br>
  maxToolRounds: 5 // 最大工具调用轮次<br>
  providers: oneapi // 默认不要修改<br>
  systemContent: 你的名字叫哈基米，你是一个热心的群友，可以热心的解决群友的问题，文明的和群友聊天 // 大模型系统提示词<br>
  forcedAvatarMode: true // 是否开启获取头像<br>
  toolsAiConfig: {
    toolsAiUrl: https://api.openai.com/v1/chat/completions,
    toolsAiModel: gemini-2.5-flash,
    toolsAiApikey: sk-xxxxx
  } // 工具调用大模型配置<br>
  chatAiConfig: {
    chatApiUrl: https://api.openai.com/v1/chat/completions,
    chatApiModel: gemini-2.5-pro,
    chatApiKey: sk-xxxxx
  } // ai对话大模型配置<br>
  imageEditAiConfig: {
    imageEditApiUrl: https://api.openai.com/v1/chat/completions,
    imageEditApiModel: gemini-3-pro-image-preview,
    imageEditApiKey: sk-xxxxx
  } // 图片编辑、画图大模型配置(GoogleImageEditTool、BananaTool等本地工具使用)<br>
  analysisAiConfig: {
    analysisApiUrl: https://api.openai.com/v1/chat/completions,
    analysisApiModel: gemini-3-pro-preview,
    analysisApiKey: sk-xxxxx
  } // 识图大模型配置(GoogleAnalysisTool等本地工具使用)<br>
  searchAiConfig: {
    searchApiUrl: https://api.openai.com/v1/chat/completions,
    searchApiModel: deepseek-r1-search,
    searchApiKey: sk-xxxxx
  } // 联网大模型配置(searchInformationTool等本地工具使用)<br>
  openai_tool_choice: auto<br>
  oneapi_tools: // 启用的本地工具<br>
    - likeTool
    - pokeTool
    - googleImageAnalysisTool
    - aiMindMapTool
    - bananaTool
    - bingImageSearchTool
    - changeCardTool
    - chatHistoryTool
    - githubRepoTool
    - googleImageEditTool
    - jinyanTool
    - qqZoneTool
    - freeSearchTool
    - searchMusicTool
    - searchVideoTool
    - videoAnalysisTool
    - voiceTool
    - webParserTool
  githubToken: "" // github token配置(GithubTool工具使用)<br>
  qqMusicToken: "" // qq音乐 token配置(SearchMusicTool工具使用)<br>