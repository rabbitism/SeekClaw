import { describe, expect, it } from 'vitest'
import {
  computeTurnTaskSteps,
  determineMilestoneTitles,
  extractPromptTarget,
  parseMarkdownChecklist
} from './task-planner'
import type { ChatMessage } from './types'

describe('extractPromptTarget', () => {
  it('extracts filename from prompt', () => {
    expect(extractPromptTarget('检查preview.py的逻辑问题')).toBe('preview.py')
    expect(extractPromptTarget('修改 App.vue 中的样式')).toBe('App.vue')
  })

  it('extracts component/noun targets from action prompt', () => {
    expect(extractPromptTarget('优化导入技能按钮位置')).toBe('导入技能按钮')
    expect(extractPromptTarget('删除assistant-meta节点')).toBe('assistant-meta节点')
  })
})

describe('parseMarkdownChecklist', () => {
  it('parses standard markdown checkbox list', () => {
    const text = `
Here is my plan:
- [x] 浏览项目结构与核心模块
- [/] 阅读测试文件了解覆盖范围
- [ ] 运行单元测试并分析结果
`
    const parsed = parseMarkdownChecklist(text)
    expect(parsed).not.toBeNull()
    expect(parsed).toHaveLength(3)
    expect(parsed![0]).toEqual({
      id: 'parsed-step-1',
      step: 1,
      title: '浏览项目结构与核心模块',
      state: 'done'
    })
    expect(parsed![1]).toEqual({
      id: 'parsed-step-2',
      step: 2,
      title: '阅读测试文件了解覆盖范围',
      state: 'running'
    })
    expect(parsed![2]).toEqual({
      id: 'parsed-step-3',
      step: 3,
      title: '运行单元测试并分析结果',
      state: 'pending'
    })
  })

  it('returns null for plain text without checklist', () => {
    const text = 'I will first read the project and then run tests.'
    expect(parseMarkdownChecklist(text)).toBeNull()
  })
})

describe('determineMilestoneTitles', () => {
  it('generates concrete file-specific milestones for target files', () => {
    const titles = determineMilestoneTitles('检查preview.py的逻辑问题')
    expect(titles[0]).toBe('检查 preview.py 的代码与逻辑实现')
    expect(titles[1]).toBe('排查并定位 preview.py 的异常原因')
    expect(titles[2]).toBe('实施修复并验证 preview.py 运行结果')
  })

  it('generates concrete target-specific milestones for UI/components', () => {
    const titles = determineMilestoneTitles('优化导入技能按钮位置')
    expect(titles[0]).toBe('检查并定位 导入技能按钮 相关文件与实现')
    expect(titles[1]).toBe('实施 导入技能按钮 代码与配置修改')
  })

  it('generates exploration milestones for reading requests', () => {
    const titles = determineMilestoneTitles('简单阅读项目，方便我们后续的开发')
    expect(titles).toContain('浏览项目整体结构与核心模块')
    expect(titles).toContain('深入阅读各核心模块实现')
    expect(titles).toContain('检查工程配置与测试覆盖范围')
  })
})

describe('computeTurnTaskSteps', () => {
  it('synthesizes high-level plan steps and tracks real-time progress', () => {
    const turnAssistants: ChatMessage[] = [
      {
        id: 'ast-1',
        role: 'assistant',
        content: '',
        thinking: '正在分析项目结构',
        state: 'thinking',
        createdAt: 0,
        tools: [
          {
            id: 't-1',
            name: 'list_dir',
            state: 'done'
          }
        ]
      }
    ]

    const steps = computeTurnTaskSteps({
      userPrompt: '简单阅读项目，方便我们后续的开发',
      turnAssistants,
      isTurnRunning: true
    })

    expect(steps.length).toBe(4)
    expect(steps[0]!.title).toBe('浏览项目整体结构与核心模块')
    expect(steps[0]!.state).toBe('running')
    expect(steps[1]!.state).toBe('pending')
  })

  it('marks all completed steps as done when turn is finished', () => {
    const turnAssistants: ChatMessage[] = [
      {
        id: 'ast-1',
        role: 'assistant',
        content: '项目概览已总结完毕。',
        state: 'done',
        createdAt: 0,
        tools: [
          {
            id: 't-1',
            name: 'read_file',
            state: 'done'
          }
        ]
      }
    ]

    const steps = computeTurnTaskSteps({
      userPrompt: '简单阅读项目，方便我们后续的开发',
      turnAssistants,
      isTurnRunning: false
    })

    expect(steps.length).toBe(4)
    expect(steps.every((s) => s.state === 'done')).toBe(true)
  })

  it('uses explicit customPlan from update_plan tool and finalizes running steps', () => {
    const customPlan = [
      { id: '1', step: 1, title: '阶段一：检查 preview.py', state: 'done' as const },
      { id: '2', step: 2, title: '阶段二：修复逻辑异常', state: 'running' as const }
    ]

    const stepsRunning = computeTurnTaskSteps({
      userPrompt: '测试任务',
      turnAssistants: [],
      isTurnRunning: true,
      customPlan
    })
    expect(stepsRunning[1]!.state).toBe('running')

    const stepsFinished = computeTurnTaskSteps({
      userPrompt: '测试任务',
      turnAssistants: [],
      isTurnRunning: false,
      customPlan
    })
    expect(stepsFinished[1]!.state).toBe('done')
  })
})
