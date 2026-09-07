<script setup lang="ts">
import {
  Blocks,
  Check,
  Copy,
  ExternalLink,
  Folder,
  FolderCog,
  FolderOpen,
  GitBranch,
  Info,
  LoaderCircle,
  Power,
  RefreshCw,
  SlidersHorizontal,
  Terminal,
  Wrench,
  X
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import type { GitOverview } from '../../../shared/ipc'
import type { ProjectItem, ThreadItem } from '../types'

interface McpServerInfo {
  name: string
  scope: 'workspace' | 'global'
  transport: 'stdio' | 'sse' | 'http' | string
  command?: string
  args: string[]
  url?: string
  envKeys: string[]
  enabled: boolean
  connected: boolean
  toolCount: number
  error?: string
}

interface SkillInfo {
  name: string
  description?: string
  version?: string
  enabled: boolean
  directory: string
  scope: 'workspace' | 'global'
}

const props = defineProps<{
  open: boolean
  project?: ProjectItem
  threads?: ThreadItem[]
}>()

const emit = defineEmits<{
  close: []
  initializeWorkspace: [project: ProjectItem]
  openExtensions: [tab: 'mcp' | 'skills']
}>()

const activeTab = ref<'general' | 'mcp' | 'skills'>('general')
const gitOverview = ref<GitOverview | null>(null)
const gitLoading = ref(false)
const mcpServers = ref<McpServerInfo[]>([])
const skills = ref<SkillInfo[]>([])
const loadingData = ref(false)
const error = ref('')
const copied = ref(false)

async function requestJson<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await window.seekclaw.daemon.request(method, params)
  return JSON.parse(response.data) as T
}

async function loadProjectData(): Promise<void> {
  if (!props.project) return
  error.value = ''
  loadingData.value = true

  try {
    const [mcpData, skillsData] = await Promise.all([
      requestJson<McpServerInfo[]>('mcp.list').catch(() => [] as McpServerInfo[]),
      requestJson<SkillInfo[]>('skill.list').catch(() => [] as SkillInfo[])
    ])
    mcpServers.value = mcpData
    skills.value = skillsData
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loadingData.value = false
  }

  gitLoading.value = true
  try {
    gitOverview.value = await window.seekclaw.project.gitOverview(props.project.path)
  } catch {
    gitOverview.value = null
  } finally {
    gitLoading.value = false
  }
}

watch(() => [props.open, props.project?.id] as const, ([isOpen, projectId]) => {
  if (isOpen && projectId) {
    activeTab.value = 'general'
    void loadProjectData()
  }
}, { immediate: true })

const projectMcpServers = computed(() =>
  mcpServers.value.filter((s) => s.scope === 'workspace')
)

const projectSkills = computed(() =>
  skills.value.filter((s) => s.scope === 'workspace')
)

const activeTasksCount = computed(() =>
  (props.threads ?? []).filter((t) => t.projectId === props.project?.id && !t.archived).length
)

const archivedTasksCount = computed(() =>
  (props.threads ?? []).filter((t) => t.projectId === props.project?.id && t.archived).length
)

async function copyPath(): Promise<void> {
  if (!props.project?.path) return
  await navigator.clipboard.writeText(props.project.path)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1800)
}

function openFolder(): void {
  if (props.project?.path) {
    void window.seekclaw.showItemInFolder(props.project.path)
  }
}

function openTerminal(): void {
  if (props.project?.path) {
    void window.seekclaw.project.openTerminal(props.project.path)
  }
}

async function toggleMcp(server: McpServerInfo): Promise<void> {
  try {
    mcpServers.value = await requestJson<McpServerInfo[]>('mcp.upsert', {
      name: server.name,
      scope: 'workspace',
      enabled: !server.enabled
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function toggleSkill(skill: SkillInfo): Promise<void> {
  try {
    skills.value = await requestJson<SkillInfo[]>('skill.toggle', {
      name: skill.name,
      enabled: !skill.enabled
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function navigateToExtensions(tab: 'mcp' | 'skills'): void {
  emit('close')
  emit('openExtensions', tab)
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="open && project" class="modal-backdrop project-properties-backdrop" @mousedown.self="emit('close')">
      <section class="project-properties-dialog" role="dialog" aria-modal="true" aria-labelledby="project-properties-title">
        <!-- Header -->
        <header class="properties-header">
          <div class="header-left">
            <span class="project-icon-badge">
              <Folder :size="20" />
            </span>
            <div class="header-text">
              <div class="header-title-row">
                <h2 id="project-properties-title">{{ project.name }}</h2>
                <span class="project-tag">项目属性</span>
              </div>
              <p class="header-path" :title="project.path">{{ project.path }}</p>
            </div>
          </div>
          <div class="header-actions">
            <button type="button" class="icon-button" title="刷新数据" :disabled="loadingData" @click="loadProjectData">
              <RefreshCw :size="15" :class="{ spin: loadingData }" />
            </button>
            <button type="button" class="icon-button" title="关闭" @click="emit('close')">
              <X :size="18" />
            </button>
          </div>
        </header>

        <!-- Navigation Tabs -->
        <nav class="properties-tabs">
          <button type="button" class="tab-item" :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">
            <Info :size="15" />
            <span>概览属性</span>
          </button>
          <button type="button" class="tab-item" :class="{ active: activeTab === 'mcp' }" @click="activeTab = 'mcp'">
            <Blocks :size="15" />
            <span>专属 MCP</span>
            <span v-if="projectMcpServers.length > 0" class="tab-badge">{{ projectMcpServers.length }}</span>
          </button>
          <button type="button" class="tab-item" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">
            <Wrench :size="15" />
            <span>专属技能</span>
            <span v-if="projectSkills.length > 0" class="tab-badge">{{ projectSkills.length }}</span>
          </button>
        </nav>

        <div v-if="error" class="properties-error">
          {{ error }}
        </div>

        <!-- Body Content -->
        <div class="properties-body">
          <!-- 1. Overview Tab -->
          <template v-if="activeTab === 'general'">
            <div class="property-block">
              <div class="block-label">物理路径与快捷操作</div>
              <div class="path-box">
                <span class="path-text" :title="project.path">{{ project.path }}</span>
                <div class="path-actions">
                  <button type="button" class="icon-button compact" :title="copied ? '已复制' : '复制路径'" @click="copyPath">
                    <Check v-if="copied" :size="14" class="success-icon" />
                    <Copy v-else :size="14" />
                  </button>
                  <button type="button" class="icon-button compact" title="在文件资源管理器中打开" @click="openFolder">
                    <FolderOpen :size="14" />
                  </button>
                  <button type="button" class="icon-button compact" title="在终端中打开" @click="openTerminal">
                    <Terminal :size="14" />
                  </button>
                </div>
              </div>
            </div>

            <div class="property-grid">
              <!-- Git Status Card -->
              <div class="property-card">
                <div class="card-header">
                  <GitBranch :size="16" class="accent-icon" />
                  <h4>Git 版本控制</h4>
                </div>
                <div v-if="gitLoading" class="card-loading">
                  <LoaderCircle :size="14" class="spin" /> 正在检查 Git 仓库…
                </div>
                <div v-else-if="gitOverview?.isRepository" class="card-content">
                  <div class="info-row">
                    <span class="label">当前分支</span>
                    <span class="badge branch-badge">{{ gitOverview.branch }}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">工作区状态</span>
                    <span :class="gitOverview.status.length > 0 ? 'badge warning-badge' : 'badge clean-badge'">
                      {{ gitOverview.status.length > 0 ? `${gitOverview.status.length} 个未提交更改` : '工作区整洁' }}
                    </span>
                  </div>
                </div>
                <div v-else class="card-content text-muted">
                  未检测到 Git 仓库
                </div>
              </div>

              <!-- Workspace Stats Card -->
              <div class="property-card">
                <div class="card-header">
                  <SlidersHorizontal :size="16" class="accent-icon" />
                  <h4>任务统计</h4>
                </div>
                <div class="card-content">
                  <div class="info-row">
                    <span class="label">活跃任务</span>
                    <span class="badge">{{ activeTasksCount }} 个</span>
                  </div>
                  <div class="info-row">
                    <span class="label">已归档任务</span>
                    <span class="badge text-muted">{{ archivedTasksCount }} 个</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Workspace Metadata Quick Action -->
            <div class="property-block">
              <div class="block-label">工作区元数据配置</div>
              <div class="metadata-card">
                <div class="metadata-desc">
                  <strong>.seekclaw 工作区配置</strong>
                  <p>在项目根目录生成专属 <code>.seekclaw/</code> 目录、提示词与技能存储路径。</p>
                </div>
                <button type="button" class="secondary-button" @click="emit('initializeWorkspace', project)">
                  <FolderCog :size="15" /> 初始化元数据
                </button>
              </div>
            </div>
          </template>

          <!-- 2. Project MCP Tab -->
          <template v-else-if="activeTab === 'mcp'">
            <div class="tab-header-row">
              <div>
                <h3 class="tab-section-title">项目专属 MCP 服务</h3>
                <p class="tab-section-desc">仅对当前项目生效的 Model Context Protocol 扩展（由 <code>mcp/servers.json</code> 或项目配置提供）。</p>
              </div>
              <button type="button" class="secondary-button compact" @click="navigateToExtensions('mcp')">
                <ExternalLink :size="13" /> 打开 MCP 管理
              </button>
            </div>

            <div v-if="projectMcpServers.length === 0" class="empty-state">
              <Blocks :size="32" class="empty-icon" />
              <h4>暂无项目专属 MCP 服务</h4>
              <p>可在项目根目录创建 <code>mcp/servers.json</code> 或 <code>.seekclaw/config.json</code> 定义项目专用的 MCP 扩展。</p>
              <button type="button" class="secondary-button" @click="navigateToExtensions('mcp')">
                配置 MCP 服务
              </button>
            </div>

            <div v-else class="settings-list">
              <div v-for="server in projectMcpServers" :key="server.name" class="settings-list-row">
                <div class="row-main">
                  <div class="row-title">
                    <span class="name">{{ server.name }}</span>
                    <span class="transport-tag">{{ server.transport.toUpperCase() }}</span>
                    <span class="scope-tag workspace">项目专属</span>
                    <span class="status-indicator" :class="{
                      'is-connected': server.connected,
                      'is-error': Boolean(server.error),
                      'is-disabled': !server.enabled
                    }">
                      <span class="dot" />
                      {{ !server.enabled ? '已禁用' : server.connected ? '已连接' : server.error ? '连接异常' : '未连接' }}
                    </span>
                  </div>
                  <div class="row-subtitle">
                    <span v-if="server.command">命令: <code>{{ server.command }} {{ server.args.join(' ') }}</code></span>
                    <span v-else-if="server.url">URL: <code>{{ server.url }}</code></span>
                    <span v-if="server.toolCount > 0" class="tool-count">· 包含 {{ server.toolCount }} 个工具</span>
                  </div>
                  <div v-if="server.error" class="row-error">
                    {{ server.error }}
                  </div>
                </div>

                <div class="row-actions">
                  <button type="button" class="icon-button" :class="{ 'is-active': server.enabled }" :title="server.enabled ? '禁用服务' : '启用服务'" @click="toggleMcp(server)">
                    <Power :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- 3. Project Skills Tab -->
          <template v-else-if="activeTab === 'skills'">
            <div class="tab-header-row">
              <div>
                <h3 class="tab-section-title">项目专属技能</h3>
                <p class="tab-section-desc">仅对当前项目生效的提示词技能（位于 <code>&lt;project&gt;/skills/</code> 或 <code>.seekclaw/skills/</code> 目录下）。</p>
              </div>
              <button type="button" class="secondary-button compact" @click="navigateToExtensions('skills')">
                <ExternalLink :size="13" /> 打开技能管理
              </button>
            </div>

            <div v-if="projectSkills.length === 0" class="empty-state">
              <Wrench :size="32" class="empty-icon" />
              <h4>暂无项目专属技能</h4>
              <p>可在项目根目录创建 <code>skills/&lt;技能名&gt;/prompt.txt</code> 来为当前项目注入专属指令与知识库。</p>
              <button type="button" class="secondary-button" @click="navigateToExtensions('skills')">
                管理全部技能
              </button>
            </div>

            <div v-else class="settings-list">
              <div v-for="skill in projectSkills" :key="skill.name" class="settings-list-row">
                <div class="row-main">
                  <div class="row-title">
                    <span class="name">{{ skill.name }}</span>
                    <span v-if="skill.version" class="version-tag">v{{ skill.version }}</span>
                    <span class="scope-tag workspace">项目专属</span>
                  </div>
                  <p v-if="skill.description" class="row-desc">{{ skill.description }}</p>
                  <div class="row-meta">
                    <span class="directory-path" :title="skill.directory">{{ skill.directory }}</span>
                  </div>
                </div>

                <div class="row-actions">
                  <button type="button" class="icon-button" :class="{ 'is-active': skill.enabled }" :title="skill.enabled ? '禁用技能' : '启用技能'" @click="toggleSkill(skill)">
                    <Power :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <footer class="properties-footer">
          <div class="footer-actions">
            <button type="button" class="secondary-button primary-action" @click="emit('close')">
              关闭
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.project-properties-backdrop {
  position: fixed;
  z-index: 120;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
}

.project-properties-dialog {
  width: min(100%, 680px);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-raised, #ffffff);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.properties-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px 14px;
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.project-icon-badge {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 10px;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title-row h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--surface-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.header-path {
  margin: 0;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.properties-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 18px;
  background: var(--sidebar, var(--surface-hover));
  border-bottom: 1px solid var(--border);
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 550;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 140ms ease;
}

.tab-item:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.tab-item.active {
  color: var(--accent);
  background: var(--surface-raised);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.tab-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
}

.properties-error {
  margin: 12px 20px 0;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border-radius: 8px;
}

.properties-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--surface-raised);
}

.property-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.path-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 9px;
}

.path-text {
  font-family: var(--font-mono, monospace);
  font-size: 12.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.success-icon {
  color: #10b981;
}

.property-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.property-card {
  padding: 14px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.accent-icon {
  color: var(--accent);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12.5px;
}

.card-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.info-row .label {
  color: var(--text-muted);
}

.badge {
  padding: 2px 8px;
  font-size: 11.5px;
  font-weight: 550;
  border-radius: 6px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
}

.branch-badge {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
}

.clean-badge {
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
}

.warning-badge {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
}

.metadata-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.metadata-desc strong {
  font-size: 13px;
  color: var(--text);
}

.metadata-desc p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.metadata-desc code {
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  background: var(--surface-raised);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.tab-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.tab-section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.tab-section-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.tab-section-desc code {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  background: var(--surface-hover);
  padding: 1px 4px;
  border-radius: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  gap: 10px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--surface-hover);
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.6;
}

.empty-state h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.empty-state p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  max-width: 420px;
}

.empty-state p code {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  background: var(--surface-raised);
  padding: 1px 4px;
  border-radius: 4px;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.row-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.row-title .name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
}

.transport-tag, .version-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-raised);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.scope-tag.workspace {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
}

.status-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-indicator.is-connected {
  color: #10b981;
}
.status-indicator.is-connected .dot {
  background: #10b981;
}

.status-indicator.is-error {
  color: var(--danger);
}
.status-indicator.is-error .dot {
  background: var(--danger);
}

.row-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-subtitle code {
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  background: var(--surface-raised);
  padding: 1px 4px;
  border-radius: 4px;
}

.row-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.row-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-error {
  font-size: 11.5px;
  color: var(--danger);
  margin-top: 2px;
}

.row-actions button.is-active {
  color: var(--accent);
  background: var(--accent-soft);
}

.properties-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 12px 20px;
  background: var(--sidebar, var(--surface-hover));
  border-top: 1px solid var(--border);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
