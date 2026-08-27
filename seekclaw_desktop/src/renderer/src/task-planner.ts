import type { ChatMessage, ToolActivity } from './types'

export interface TaskStep {
  id: string
  step: number
  title: string
  detail?: string
  state: 'running' | 'done' | 'error' | 'pending'
}

/**
 * Extracts a markdown checklist if the model explicitly emitted one in its text or thinking.
 * e.g.:
 * - [x] 浏览项目结构与核心模块
 * - [/] 阅读测试文件了解覆盖范围
 * - [ ] 运行单元测试并分析结果
 */
export function parseMarkdownChecklist(text?: string): TaskStep[] | null {
  if (!text || !text.includes('[')) return null

  const lines = text.split(/\r?\n/)
  const checklistRegex = /^(?:[-*]|\d+\.)\s*\[([ xX/\\-~])\]\s*(.+)$/
  const items: TaskStep[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    const match = checklistRegex.exec(trimmed)
    if (match) {
      const mark = match[1]!.trim().toLowerCase()
      const title = match[2]!.trim()
      if (!title) continue

      let state: TaskStep['state'] = 'pending'
      if (mark === 'x') {
        state = 'done'
      } else if (mark === '/' || mark === '-' || mark === '~') {
        state = 'running'
      }

      items.push({
        id: `parsed-step-${items.length + 1}`,
        step: items.length + 1,
        title,
        state
      })
    }
  }

  // Only consider it a real checklist if at least 2 items were parsed
  return items.length >= 2 ? items : null
}

/**
 * Extracts a specific filename or key target noun from the user's prompt.
 * e.g.:
 * "检查preview.py的逻辑问题" -> "preview.py"
 * "删除assistant-meta节点" -> "assistant-meta 节点"
 * "优化导入技能按钮位置" -> "导入技能按钮"
 */
export function extractPromptTarget(prompt: string): string | null {
  const trimmed = prompt.trim()
  if (!trimmed) return null

  // 1. Look for explicit filenames with extensions (e.g. preview.py, App.vue, build.cmd)
  const fileMatch = /\b([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9_]{1,6})\b/.exec(trimmed)
  if (fileMatch) {
    return fileMatch[1]!
  }

  // 2. Look for code symbols or quoted targets (e.g. `assistant-meta`, 'preview')
  const quotedMatch = /[`'"]([^`'"]+)[`'"]/.exec(trimmed)
  if (quotedMatch && quotedMatch[1]!.trim().length > 1) {
    return quotedMatch[1]!.trim()
  }

  // 3. Look for phrases after action verbs like 检查/修改/优化/删除/实现
  const actionMatch = /(?:检查|排查|定位|修改|删除|优化|实现|重构|新增|添加)\s*([a-zA-Z0-9_\u4e00-\u9fa5\-]{2,16}(?:节点|组件|按钮|模块|方法|函数|页面|接口|服务|配置)?)/.exec(trimmed)
  if (actionMatch) {
    let raw = actionMatch[1]!.trim()
    raw = raw.replace(/(?:位置|问题|逻辑|布局|效果|代码)$/, '').trim()
    const stopwords = ['这个', '一下', '代码', '问题', '项目', '文件', '模块', '功能', '逻辑']
    if (raw && !stopwords.includes(raw) && raw.length >= 2) {
      return raw
    }
  }

  return null
}

/**
 * Classifies user intent from prompt and produces concrete, non-boilerplate task milestone titles.
 */
export function determineMilestoneTitles(prompt: string): string[] {
  const p = (prompt || '').toLowerCase()
  const target = extractPromptTarget(prompt)

  // 1. If a specific target or file is identified (e.g. "检查preview.py的逻辑问题", "删除assistant-meta节点")
  if (target) {
    if (
      p.includes('检查') ||
      p.includes('排查') ||
      p.includes('定位') ||
      p.includes('分析') ||
      p.includes('bug') ||
      p.includes('报错') ||
      p.includes('问题')
    ) {
      return [
        `检查 ${target} 的代码与逻辑实现`,
        `排查并定位 ${target} 的异常原因`,
        `实施修复并验证 ${target} 运行结果`,
        '整理分析结论与答复'
      ]
    }

    if (
      p.includes('修改') ||
      p.includes('删除') ||
      p.includes('优化') ||
      p.includes('重构') ||
      p.includes('实现') ||
      p.includes('新增') ||
      p.includes('添加')
    ) {
      return [
        `检查并定位 ${target} 相关文件与实现`,
        `实施 ${target} 代码与配置修改`,
        '运行构建与功能验证',
        '确认改动成果并输出说明'
      ]
    }
  }

  // 2. 阅读/探索/架构/概览类任务
  if (
    p.includes('阅读') ||
    p.includes('浏览') ||
    p.includes('探索') ||
    p.includes('架构') ||
    p.includes('结构') ||
    p.includes('了解') ||
    p.includes('分析项目') ||
    p.includes('查看项目') ||
    p.includes('read') ||
    p.includes('explore') ||
    p.includes('survey') ||
    p.includes('overview')
  ) {
    return [
      '浏览项目整体结构与核心模块',
      '深入阅读各核心模块实现',
      '检查工程配置与测试覆盖范围',
      '整理并输出项目开发指南'
    ]
  }

  // 3. Bug 修复 / 报错 / 排查类任务
  if (
    p.includes('修复') ||
    p.includes('fix') ||
    p.includes('bug') ||
    p.includes('报错') ||
    p.includes('error') ||
    p.includes('失败') ||
    p.includes('异常') ||
    p.includes('crash') ||
    p.includes('issue') ||
    p.includes('排查') ||
    p.includes('解决')
  ) {
    return [
      '分析问题根因与调用链路',
      '定位并检查相关源码与上下文',
      '实施代码修复与逻辑调整',
      '执行构建与测试验证',
      '确认修复效果并输出解答'
    ]
  }

  // 4. 测试 / 构建 / 编译类任务
  if (
    p.includes('测试') ||
    p.includes('test') ||
    p.includes('构建') ||
    p.includes('build') ||
    p.includes('编译') ||
    p.includes('compile') ||
    p.includes('跑测试') ||
    p.includes('验证')
  ) {
    return [
      '检索工程配置与测试用例定义',
      '执行测试套件并监控运行状态',
      '分析测试输出与覆盖情况',
      '汇总测试报告与评估结论'
    ]
  }

  // 5. 通用编码与实现任务
  return [
    '分析任务需求要点与相关实现',
    '定位目标源码并设计方案',
    '实施代码修改与逻辑优化',
    '执行验证并输出最终解答'
  ]
}

/**
 * Computes the active turn's high-level task plan steps dynamically.
 */
export function computeTurnTaskSteps(params: {
  userPrompt: string
  turnAssistants: ChatMessage[]
  isTurnRunning: boolean
  currentPhase?: string
  customPlan?: TaskStep[]
}): TaskStep[] {
  const { userPrompt, turnAssistants, isTurnRunning, currentPhase, customPlan } = params

  if (!userPrompt && turnAssistants.length === 0 && (!customPlan || customPlan.length === 0)) return []

  const allTools: ToolActivity[] = turnAssistants.flatMap((a) => a.tools ?? [])
  const lastAssistant = turnAssistants[turnAssistants.length - 1]
  const hasError = lastAssistant?.state === 'error' || allTools.some((t) => t.state === 'error')

  // 1. If the AI explicitly called update_plan, use that custom plan
  if (customPlan && customPlan.length > 0) {
    if (!isTurnRunning && !hasError) {
      return customPlan.map((s) => ({
        ...s,
        state: s.state === 'running' ? 'done' : s.state
      }))
    }
    return customPlan
  }

  // 2. Try parsing explicit checklist from model's thinking or output
  for (let i = turnAssistants.length - 1; i >= 0; i--) {
    const assistant = turnAssistants[i]
    if (!assistant) continue

    const parsedFromContent = parseMarkdownChecklist(assistant.content)
    if (parsedFromContent) return parsedFromContent

    const parsedFromThinking = parseMarkdownChecklist(assistant.thinking)
    if (parsedFromThinking) return parsedFromThinking
  }

  // 3. Synthesize semantic milestone plan based on prompt and real-time execution
  const titles = determineMilestoneTitles(userPrompt)

  const readTools = allTools.filter((t) => {
    const name = (t.name || '').toLowerCase()
    return (
      name.includes('read') ||
      name.includes('view') ||
      name.includes('search') ||
      name.includes('grep') ||
      name.includes('find') ||
      name.includes('glob') ||
      name.includes('list') ||
      name.includes('fetch') ||
      name.includes('web')
    )
  })

  const editTools = allTools.filter((t) => {
    const name = (t.name || '').toLowerCase()
    return name.includes('edit') || name.includes('write') || name.includes('patch') || Boolean(t.diff)
  })

  const cmdTools = allTools.filter((t) => {
    const name = (t.name || '').toLowerCase()
    return (
      name.includes('bash') ||
      name.includes('command') ||
      name.includes('exec') ||
      name.includes('test') ||
      name.includes('verify')
    )
  })

  const editedFileNames = Array.from(
    new Set(
      editTools
        .map((t) => (t.filePath ? t.filePath.split(/[\\/]/).pop() : undefined))
        .filter(Boolean)
    )
  ) as string[]

  const count = titles.length
  const lastStepIndex = count - 1

  // Determine current active milestone index (0 to count - 1)
  let activeIndex = 0

  if (!isTurnRunning) {
    // When turn finished successfully, all completed steps are done
    activeIndex = hasError ? Math.max(0, count - 2) : count
  } else {
    // When turn is running:
    if (lastAssistant?.state === 'streaming' || (lastAssistant?.content && allTools.every((t) => t.state === 'done'))) {
      activeIndex = lastStepIndex
    } else if (cmdTools.length > 0 || (currentPhase && currentPhase.includes('验证'))) {
      activeIndex = Math.min(lastStepIndex - 1, Math.max(1, count - 2))
    } else if (editTools.length > 0 || (currentPhase && currentPhase.includes('编辑'))) {
      activeIndex = Math.min(lastStepIndex - 1, count >= 5 ? 2 : 1)
    } else if (readTools.length > 3 || (currentPhase && currentPhase.includes('阅读'))) {
      activeIndex = 1
    } else {
      activeIndex = 0
    }
  }

  const steps: TaskStep[] = titles.map((title, index) => {
    let state: TaskStep['state'] = 'pending'
    let detail: string | undefined

    if (index < activeIndex) {
      state = 'done'
    } else if (index === activeIndex) {
      state = isTurnRunning ? 'running' : (hasError ? 'error' : 'done')
    } else {
      state = 'pending'
    }

    // Contextual details for steps
    if (index === 0 && readTools.length > 0) {
      detail = `已检索 ${readTools.length} 处代码与上下文`
    } else if (title.includes('修改') || title.includes('编写') || title.includes('实施') || title.includes('修复')) {
      if (editedFileNames.length > 0) {
        detail = `修改 ${editedFileNames.slice(0, 3).join(', ')}${editedFileNames.length > 3 ? ` 等 ${editedFileNames.length} 个文件` : ''}`
      } else if (editTools.length > 0) {
        detail = `已执行 ${editTools.length} 处代码变更`
      }
    } else if (title.includes('测试') || title.includes('验证') || title.includes('构建')) {
      if (cmdTools.length > 0) {
        detail = `已执行 ${cmdTools.length} 条测试与验证命令`
      }
    } else if (index === lastStepIndex && lastAssistant?.content) {
      detail = isTurnRunning ? '正在输出总结与解答' : '已生成完整解答'
    }

    return {
      id: `task-step-${index + 1}`,
      step: index + 1,
      title,
      detail,
      state
    }
  })

  return steps
}
