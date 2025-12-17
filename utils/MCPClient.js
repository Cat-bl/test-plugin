// utils/MCPClient.js
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

export class MCPClientManager {
    constructor() {
        this.clients = new Map()        // 存储多个MCP服务器连接: serverName -> {client, transport, type, config}
        this.tools = new Map()          // 工具名 -> {client, toolInfo, serverName}
        this.serverConfigs = new Map()  // 存储服务器完整配置（包含systemPrompt）
    }

    /**
     * 连接到MCP服务器（自动识别 stdio/sse 类型）
     * @param {string} serverName - 服务器标识名
     * @param {object} config - 服务器配置
     */
    async connectServer(serverName, config) {
        try {
            // 如果已连接，先断开
            if (this.clients.has(serverName)) {
                logger.info(`[MCP] 服务器 ${serverName} 已存在，正在重新连接...`)
                await this.disconnectServer(serverName)
            }

            // 根据类型选择传输方式
            const transportType = (config.type || 'stdio').toLowerCase()
            let transport

            if (transportType === 'sse') {
                // SSE 远程服务器
                transport = this.createSSETransport(serverName, config)
                logger.info(`[MCP] 正在连接 SSE 服务器: ${serverName}`)
            } else {
                // stdio 本地服务器
                transport = this.createStdioTransport(serverName, config)
                logger.info(`[MCP] 正在连接 stdio 服务器: ${serverName}`)
            }

            // 创建MCP客户端
            const client = new Client({
                name: "yunzai-mcp-client",
                version: "1.0.0"
            }, {
                capabilities: {}
            })

            // 连接服务器
            await client.connect(transport)

            // 保存客户端信息
            this.clients.set(serverName, {
                client,
                transport,
                type: transportType,
                config
            })

            // 保存完整配置（包含 systemPrompt）
            this.serverConfigs.set(serverName, {
                ...config,
                type: transportType,
                connected: true,
                connectedAt: new Date().toISOString()
            })

            logger.info(`[MCP] 已连接服务器: ${serverName} (${transportType})`)

            // 获取并注册该服务器的工具
            await this.registerServerTools(serverName, client)

            return true
        } catch (error) {
            logger.error(`[MCP] 连接服务器 ${serverName} 失败:`, error)

            // 记录失败的配置
            this.serverConfigs.set(serverName, {
                ...config,
                connected: false,
                error: error.message
            })

            return false
        }
    }

    /**
     * 创建 SSE 传输（远程服务器）
     * @param {string} serverName - 服务器名
     * @param {object} config - 配置
     */
    createSSETransport(serverName, config) {
        if (!config.baseUrl) {
            throw new Error(`SSE 服务器 ${serverName} 需要配置 baseUrl`)
        }

        // 构建请求头
        const headers = {}
        if (config.headers) {
            if (typeof config.headers === 'object') {
                Object.entries(config.headers).forEach(([key, value]) => {
                    // 移除可能的引号并确保是字符串
                    if (value !== undefined && value !== null) {
                        headers[key] = String(value).replace(/^["']|["']$/g, '')
                    }
                })
            }
        }

        logger.info(`[MCP] SSE 连接配置: ${config.baseUrl}`)

        // 创建 SSE 传输
        const transport = new SSEClientTransport(
            new URL(config.baseUrl),
            {
                requestInit: {
                    headers
                }
            }
        )

        return transport
    }

    /**
     * 创建 stdio 传输（本地服务器）
     * @param {string} serverName - 服务器名
     * @param {object} config - 配置
     */
    createStdioTransport(serverName, config) {
        const { command, args = [], env = {} } = config

        if (!command) {
            throw new Error(`stdio 服务器 ${serverName} 需要配置 command`)
        }

        // 过滤掉 env 中值为 undefined/null/空字符串 的项
        const cleanEnv = {}
        if (env && typeof env === 'object') {
            Object.entries(env).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    cleanEnv[key] = String(value)
                }
            })
        }

        // 创建传输层 - StdioClientTransport 会自己管理子进程
        const transport = new StdioClientTransport({
            command,
            args,
            env: { ...process.env, ...cleanEnv }
        })

        return transport
    }

    /**
     * 处理服务器断开连接
     * @param {string} serverName - 服务器名
     */
    handleServerDisconnect(serverName) {
        // 移除该服务器的工具
        for (const [toolName, { serverName: sn }] of this.tools) {
            if (sn === serverName) {
                this.tools.delete(toolName)
            }
        }

        // 更新配置状态
        const config = this.serverConfigs.get(serverName)
        if (config) {
            config.connected = false
            config.disconnectedAt = new Date().toISOString()
        }

        this.clients.delete(serverName)
    }

    /**
     * 注册服务器的所有工具
     */
    async registerServerTools(serverName, client) {
        try {
            const { tools } = await client.listTools()

            for (const tool of tools) {
                this.tools.set(tool.name, {
                    serverName,
                    client,
                    toolInfo: tool
                })
                logger.info(`[MCP] 注册工具: ${tool.name} (来自 ${serverName})`)
            }

            // 更新配置中的工具数量
            const config = this.serverConfigs.get(serverName)
            if (config) {
                config.toolCount = tools.length
                config.toolNames = tools.map(t => t.name)
            }

            return tools
        } catch (error) {
            logger.error(`[MCP] 获取工具列表失败:`, error)
            return []
        }
    }

    /**
     * 清理 Schema 中不被 OpenAI/Gemini 支持的字段
     * @param {object} schema - 原始 schema
     * @returns {object} - 清理后的 schema
     */
    cleanSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return schema
        }

        // 深拷贝避免修改原对象
        const cleaned = JSON.parse(JSON.stringify(schema))

        // 递归清理函数
        const removeUnsupportedFields = (obj) => {
            if (!obj || typeof obj !== 'object') return

            // 删除不支持的 JSON Schema 字段
            const unsupportedFields = [
                '$schema',
                '$id',
                '$ref',
                '$comment',
                '$defs',
                'definitions',
                'examples',
                'default',
            ]

            for (const field of unsupportedFields) {
                delete obj[field]
            }

            // 递归处理 properties
            if (obj.properties && typeof obj.properties === 'object') {
                for (const key of Object.keys(obj.properties)) {
                    removeUnsupportedFields(obj.properties[key])
                }
            }

            // 递归处理 items (数组类型)
            if (obj.items) {
                if (Array.isArray(obj.items)) {
                    obj.items.forEach(removeUnsupportedFields)
                } else {
                    removeUnsupportedFields(obj.items)
                }
            }

            // 递归处理 allOf, anyOf, oneOf
            const compositeFields = ['allOf', 'anyOf', 'oneOf']
            for (const field of compositeFields) {
                if (Array.isArray(obj[field])) {
                    obj[field].forEach(removeUnsupportedFields)
                }
            }

            // 递归处理 additionalProperties
            if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
                removeUnsupportedFields(obj.additionalProperties)
            }

            // 递归处理 patternProperties
            if (obj.patternProperties && typeof obj.patternProperties === 'object') {
                for (const key of Object.keys(obj.patternProperties)) {
                    removeUnsupportedFields(obj.patternProperties[key])
                }
            }
        }

        removeUnsupportedFields(cleaned)
        return cleaned
    }

    /**
     * 格式化单个工具为 OpenAI function 格式
     * @param {string} name - 工具名
     * @param {object} toolInfo - 工具信息
     * @returns {object} - 格式化后的工具定义
     */
    formatToolForAPI(name, toolInfo) {
        const cleanedSchema = this.cleanSchema(toolInfo.inputSchema)

        return {
            type: "function",
            function: {
                name: `mcp_${name}`,  // 添加前缀区分MCP工具
                description: toolInfo.description || "",
                parameters: cleanedSchema || {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        }
    }

    /**
     * 获取所有MCP工具（转换为OpenAI function格式）
     */
    getAllTools() {
        const tools = []

        for (const [name, { toolInfo }] of this.tools) {
            try {
                const formattedTool = this.formatToolForAPI(name, toolInfo)
                tools.push(formattedTool)
            } catch (error) {
                logger.error(`[MCP] 格式化工具 ${name} 失败:`, error)
            }
        }

        return tools
    }

    /**
     * 执行MCP工具
     * @param {string} toolName - 工具名（不含mcp_前缀）
     * @param {object} args - 工具参数
     */
    async executeTool(toolName, args) {
        const toolEntry = this.tools.get(toolName)

        if (!toolEntry) {
            throw new Error(`MCP工具不存在: ${toolName}`)
        }

        const { client, serverName } = toolEntry

        // 检查服务器是否仍然连接
        if (!this.clients.has(serverName)) {
            throw new Error(`MCP服务器 ${serverName} 已断开连接`)
        }

        try {
            logger.info(`[MCP] 执行工具: ${toolName}, 参数: ${JSON.stringify(args)}`)

            const result = await client.callTool({
                name: toolName,
                arguments: args
            })

            logger.info(`[MCP] 工具 ${toolName} 执行完成`)
            return result
        } catch (error) {
            logger.error(`[MCP] 执行工具 ${toolName} 失败:`, error)
            throw error
        }
    }

    /**
     * 检查是否为MCP工具
     */
    isMCPTool(toolName) {
        return toolName?.startsWith("mcp_")
    }

    /**
     * 获取真实工具名（去除mcp_前缀）
     */
    getRealToolName(toolName) {
        return toolName?.replace(/^mcp_/, "")
    }

    /**
     * 断开指定服务器
     * @param {string} serverName - 服务器名
     */
    async disconnectServer(serverName) {
        const clientInfo = this.clients.get(serverName)
        if (!clientInfo) {
            return false
        }

        try {
            // 关闭客户端连接
            if (clientInfo.client) {
                await clientInfo.client.close().catch(() => { })
            }

            // 关闭传输层（会自动关闭子进程）
            if (clientInfo.transport && typeof clientInfo.transport.close === 'function') {
                await clientInfo.transport.close().catch(() => { })
            }

            // 清理
            this.handleServerDisconnect(serverName)

            logger.info(`[MCP] 已断开服务器: ${serverName}`)
            return true
        } catch (error) {
            logger.error(`[MCP] 断开服务器 ${serverName} 失败:`, error)
            return false
        }
    }

    /**
     * 断开所有连接
     */
    async disconnectAll() {
        const serverNames = Array.from(this.clients.keys())

        for (const serverName of serverNames) {
            await this.disconnectServer(serverName)
        }

        this.clients.clear()
        this.tools.clear()
        this.serverConfigs.clear()

        logger.info(`[MCP] 已断开所有服务器连接`)
    }

    /**
     * 获取工具描述字符串
     */
    getToolsDescription() {
        const descriptions = []
        for (const [name, { toolInfo, serverName }] of this.tools) {
            descriptions.push(`mcp_${name}: [${serverName}] ${toolInfo.description || "无描述"}`)
        }
        return descriptions.join("\n")
    }

    /**
     * 获取已连接的服务器列表
     */
    getConnectedServers() {
        return Array.from(this.clients.keys())
    }

    /**
     * 获取指定服务器的工具列表
     * @param {string} serverName - 服务器名
     */
    getServerTools(serverName) {
        const tools = []
        for (const [name, { serverName: sn, toolInfo }] of this.tools) {
            if (sn === serverName) {
                tools.push({ name, ...toolInfo })
            }
        }
        return tools
    }

    /**
     * 检查服务器是否已连接
     * @param {string} serverName - 服务器名
     */
    isServerConnected(serverName) {
        return this.clients.has(serverName)
    }

    /**
     * 重连指定服务器
     * @param {string} serverName - 服务器名
     */
    async reconnectServer(serverName) {
        const clientInfo = this.clients.get(serverName)
        const config = clientInfo?.config || this.serverConfigs.get(serverName)

        if (!config) {
            logger.warn(`[MCP] 服务器 ${serverName} 配置不存在`)
            return false
        }

        // 先断开
        await this.disconnectServer(serverName)

        // 重新连接
        return await this.connectServer(serverName, config)
    }

    // ==================== 系统提示词相关方法 ====================

    /**
     * 获取所有已启用且已连接的MCP服务器的系统提示词
     * @param {object} context - 可选的上下文信息，用于条件过滤
     * @returns {string} 合并后的系统提示词
     */
    getMCPSystemPrompts(context = {}) {
        const prompts = []

        for (const [serverName, config] of this.serverConfigs) {
            // 只获取已连接且有 systemPrompt 的服务器
            if (!config.connected || !config.systemPrompt) {
                continue
            }

            // 可选：根据上下文条件过滤
            if (config.promptConditions) {
                const conditions = config.promptConditions

                // 消息类型过滤
                if (conditions.messageType && context.messageType) {
                    if (!conditions.messageType.includes(context.messageType)) {
                        continue
                    }
                }

                // 群组过滤
                if (conditions.groups && context.groupId) {
                    if (!conditions.groups.includes(context.groupId)) {
                        continue
                    }
                }

                // 关键词过滤
                if (conditions.keywords && context.message) {
                    const hasKeyword = conditions.keywords.some(kw =>
                        context.message.toLowerCase().includes(kw.toLowerCase())
                    )
                    if (!hasKeyword) {
                        continue
                    }
                }
            }

            prompts.push(`【${serverName}】\n${config.systemPrompt.trim()}`)
        }

        if (prompts.length === 0) {
            return ""
        }

        return "\n\n【MCP扩展能力】\n" + prompts.join("\n\n")
    }

    /**
     * 获取指定服务器的系统提示词
     * @param {string} serverName - 服务器名
     * @returns {string|null} 系统提示词或null
     */
    getServerSystemPrompt(serverName) {
        const config = this.serverConfigs.get(serverName)
        if (!config || !config.connected) {
            return null
        }
        return config.systemPrompt || null
    }

    /**
     * 检查指定服务器是否启用
     * @param {string} serverName - 服务器名
     * @returns {boolean}
     */
    isServerEnabled(serverName) {
        const config = this.serverConfigs.get(serverName)
        return config?.enabled === true && config?.connected === true
    }

    /**
     * 获取所有服务器配置信息（用于调试/管理）
     * @returns {Array} 服务器配置列表
     */
    getServersInfo() {
        const info = []
        for (const [serverName, config] of this.serverConfigs) {
            info.push({
                name: serverName,
                type: config.type || 'stdio',
                description: config.description || "",
                enabled: config.enabled,
                connected: config.connected,
                toolCount: config.toolCount || 0,
                toolNames: config.toolNames || [],
                hasSystemPrompt: !!config.systemPrompt,
                connectedAt: config.connectedAt,
                error: config.error
            })
        }
        return info
    }

    /**
     * 动态更新服务器的系统提示词
     * @param {string} serverName - 服务器名
     * @param {string} systemPrompt - 新的系统提示词
     */
    updateServerSystemPrompt(serverName, systemPrompt) {
        const config = this.serverConfigs.get(serverName)
        if (config) {
            config.systemPrompt = systemPrompt
            return true
        }
        return false
    }

    /**
     * 获取MCP工具的简要摘要（用于日志/调试）
     * @returns {string}
     */
    getToolsSummary() {
        const serverTools = new Map()

        for (const [toolName, { serverName }] of this.tools) {
            if (!serverTools.has(serverName)) {
                serverTools.set(serverName, [])
            }
            serverTools.get(serverName).push(toolName)
        }

        const lines = []
        for (const [server, tools] of serverTools) {
            const config = this.serverConfigs.get(server)
            const type = config?.type || 'stdio'
            lines.push(`${server} (${type}): ${tools.length}个工具 (${tools.join(", ")})`)
        }

        return lines.join("\n") || "无已加载的MCP工具"
    }

    /**
     * 根据工具名获取所属服务器
     * @param {string} toolName - 工具名（可带或不带mcp_前缀）
     * @returns {string|null} 服务器名
     */
    getToolServer(toolName) {
        const realName = this.getRealToolName(toolName)
        const toolEntry = this.tools.get(realName)
        return toolEntry?.serverName || null
    }

    /**
     * 检查工具是否可用
     * @param {string} toolName - 工具名
     * @returns {boolean}
     */
    isToolAvailable(toolName) {
        const realName = this.getRealToolName(toolName)
        const toolEntry = this.tools.get(realName)
        if (!toolEntry) return false

        // 检查对应服务器是否仍然连接
        return this.clients.has(toolEntry.serverName)
    }

    /**
     * 获取工具的详细信息
     * @param {string} toolName - 工具名
     * @returns {object|null}
     */
    getToolInfo(toolName) {
        const realName = this.getRealToolName(toolName)
        const toolEntry = this.tools.get(realName)

        if (!toolEntry) return null

        return {
            name: realName,
            displayName: `mcp_${realName}`,
            serverName: toolEntry.serverName,
            description: toolEntry.toolInfo.description,
            inputSchema: toolEntry.toolInfo.inputSchema
        }
    }

    /**
     * 批量执行多个工具（并行）
     * @param {Array} toolCalls - [{name, args}, ...]
     * @returns {Array} 执行结果
     */
    async executeToolsBatch(toolCalls) {
        const results = await Promise.allSettled(
            toolCalls.map(({ name, args }) => this.executeTool(name, args))
        )

        return results.map((result, index) => ({
            toolName: toolCalls[index].name,
            success: result.status === "fulfilled",
            result: result.status === "fulfilled" ? result.value : null,
            error: result.status === "rejected" ? result.reason.message : null
        }))
    }

    /**
     * 健康检查 - 检查所有服务器连接状态
     * @returns {object} 健康状态报告
     */
    async healthCheck() {
        const report = {
            timestamp: new Date().toISOString(),
            totalServers: this.clients.size,
            totalTools: this.tools.size,
            servers: []
        }

        for (const [serverName, { client, type }] of this.clients) {
            const serverReport = {
                name: serverName,
                type: type,
                status: "unknown",
                toolCount: 0
            }

            try {
                // 尝试列出工具来验证连接
                const { tools } = await client.listTools()
                serverReport.status = "healthy"
                serverReport.toolCount = tools.length
            } catch (error) {
                serverReport.status = "unhealthy"
                serverReport.error = error.message
            }

            report.servers.push(serverReport)
        }

        return report
    }

    /**
     * 获取连接状态摘要
     * @returns {string}
     */
    getStatusSummary() {
        const servers = this.getServersInfo()

        if (servers.length === 0) {
            return "当前没有配置任何 MCP 服务器"
        }

        const lines = ["【MCP 服务器状态】"]

        for (const server of servers) {
            const statusIcon = server.connected ? "✅" : "❌"
            const typeIcon = server.type === 'sse' ? "🌐" : "💻"

            lines.push(`\n${statusIcon} ${server.name} ${typeIcon}`)
            lines.push(`   类型: ${server.type}`)
            lines.push(`   工具数: ${server.toolCount}`)

            if (server.description) {
                lines.push(`   描述: ${server.description}`)
            }

            if (server.error) {
                lines.push(`   错误: ${server.error}`)
            }

            if (server.toolNames?.length > 0) {
                lines.push(`   工具: ${server.toolNames.slice(0, 5).join(", ")}${server.toolNames.length > 5 ? "..." : ""}`)
            }
        }

        return lines.join("\n")
    }
}

// 单例导出
export const mcpManager = new MCPClientManager()
