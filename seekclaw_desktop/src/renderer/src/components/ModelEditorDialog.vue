<script setup lang="ts">
import { Save, X } from '@lucide/vue'
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import FieldLabel from './FieldLabel.vue'

interface ModelFormValue {
  provider: string
  id: string
  alias: string
  contextWindow: number
  maxOutput: number
  vision: boolean
}

const props = defineProps<{
  open: boolean
  value: ModelFormValue
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
  save: [value: ModelFormValue]
}>()

const form = reactive<ModelFormValue>({
  provider: '',
  id: '',
  alias: '',
  contextWindow: 128000,
  maxOutput: 8192,
  vision: false
})

const firstInput = ref<HTMLInputElement | null>(null)

function close(): void {
  if (!props.saving) emit('close')
}

function save(): void {
  if (props.saving) return
  emit('save', {
    ...form,
    alias: form.alias.trim(),
    contextWindow: Number(form.contextWindow),
    maxOutput: Number(form.maxOutput)
  })
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    save()
  }
}

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, props.value)
  document.addEventListener('keydown', handleKeydown)
  void nextTick(() => firstInput.value?.focus())
}, { immediate: true })

watch(() => props.open, (open, previous) => {
  if (!open && previous) document.removeEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-backdrop model-editor-backdrop" @mousedown.self="close">
        <form class="model-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="model-editor-title" @submit.prevent="save">
          <header class="model-editor-header">
            <div>
              <h2 id="model-editor-title">编辑模型配置</h2>
              <p>{{ form.provider }} / {{ form.id }}</p>
            </div>
            <button class="icon-button" type="button" title="关闭" :disabled="saving" @click="close">
              <X :size="18" />
            </button>
          </header>

          <div class="model-editor-body">
            <section class="model-form-section">
              <div class="model-section-heading">
                <strong>基础信息</strong>
              </div>
              <div class="model-form-grid">
                <label class="form-field full-width">
                  <FieldLabel en="Display Alias" zh="显示别名" help="在任务会话与模型切换器中展示的易读别名；留空则直接展示模型原生 ID。" />
                  <input ref="firstInput" v-model="form.alias" class="form-input" placeholder="可选，例如 快速模型 / Flash" autocomplete="off" />
                </label>
              </div>
            </section>

            <section class="model-form-section">
              <div class="model-section-heading">
                <strong>Token 与上下文参数</strong>
              </div>
              <div class="model-form-grid two-columns">
                <label class="form-field">
                  <FieldLabel en="Context Window" zh="上下文长度 (Tokens)" help="单次会话支持的最大上下文 Token 总量。当会话估算 Tokens 接近该长度时，运行时会自动压缩较早的历史消息。" required />
                  <input v-model.number="form.contextWindow" class="form-input" type="number" min="1024" max="10000000" step="1024" />
                </label>
                <label class="form-field">
                  <FieldLabel en="Max Output" zh="最大输出 (Tokens)" help="模型单次响应允许输出的最大 Token 数量。" required />
                  <input v-model.number="form.maxOutput" class="form-input" type="number" min="128" max="1000000" step="128" />
                </label>
              </div>
              <small class="model-context-hint">当会话估算 Tokens 接近该上下文长度时，运行时会自动压缩较早的历史消息。</small>
            </section>

            <section class="model-form-section">
              <div class="model-section-heading">
                <strong>多模态能力</strong>
              </div>
              <label class="model-enabled-row">
                <span>
                  <strong>视觉 / 多模态输入</strong>
                  <small>声明后，上传图片时会优先使用支持视觉的模型</small>
                </span>
                <input v-model="form.vision" class="sr-only" type="checkbox" />
                <span class="toggle-switch" aria-hidden="true"><span /></span>
              </label>
            </section>

            <div v-if="error" class="model-editor-error">{{ error }}</div>
          </div>

          <footer class="model-editor-footer">
            <span>按 Ctrl + Enter 保存</span>
            <div>
              <button class="secondary-button" type="button" :disabled="saving" @click="close">取消</button>
              <button class="secondary-button primary-action" type="submit" :disabled="saving">
                <Save :size="15" /> {{ saving ? '正在保存…' : '保存模型' }}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.model-editor-backdrop {
  position: fixed;
  z-index: 130;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
}

.model-editor-dialog {
  display: flex;
  flex-direction: column;
  width: min(100%, 640px);
  max-height: min(800px, calc(100vh - 40px));
  background: var(--surface-raised, #ffffff);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28), 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.model-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px 16px;
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border);
}

.model-editor-eyebrow {
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.model-editor-header h2 {
  margin: 3px 0 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--text);
  letter-spacing: -0.01em;
}

.model-editor-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-mono, monospace);
}

.model-editor-body {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--surface-raised);
}

.model-form-section {
  display: flex;
  flex-direction: column;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.model-form-section:last-of-type {
  padding-bottom: 0;
  border-bottom: none;
}

.model-section-heading {
  display: flex;
  align-items: baseline;
  margin-bottom: 12px;
}

.model-section-heading strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.model-form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px 16px;
  width: 100%;
}

.model-form-grid.two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  width: 100%;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 38px;
  padding: 8px 12px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  outline: none;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.form-input:hover {
  border-color: color-mix(in srgb, var(--text-muted) 58%, var(--border));
}

.form-input:focus {
  border-color: color-mix(in srgb, var(--accent) 66%, var(--border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.model-context-hint {
  display: block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.5;
}

.model-enabled-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--surface-hover) 65%, transparent);
  border-radius: 9px;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: background-color 140ms ease;
}

.model-enabled-row:hover {
  background: var(--surface-hover);
}

.model-enabled-row > span:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.model-enabled-row strong {
  font-size: 13px;
  color: var(--text);
}

.model-enabled-row small {
  color: var(--text-muted);
  font-size: 11.5px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip: rect(0, 0, 0, 0);
}

.toggle-switch {
  display: flex;
  width: 38px;
  height: 22px;
  flex: 0 0 auto;
  align-items: center;
  padding: 2px;
  background: var(--border-strong);
  border-radius: 999px;
  transition: background-color 160ms ease;
}

.toggle-switch > span {
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.model-enabled-row input:checked + .toggle-switch {
  background: var(--accent);
}

.model-enabled-row input:checked + .toggle-switch > span {
  transform: translateX(16px);
}

.model-editor-error {
  margin-top: 10px;
  padding: 9px 12px;
  color: var(--danger);
  font-size: 12px;
  background: color-mix(in srgb, var(--danger) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  border-radius: 8px;
}

.model-editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 24px;
  background: color-mix(in srgb, var(--sidebar) 72%, var(--surface-raised));
  border-top: 1px solid var(--border);
}

.model-editor-footer > span {
  color: var(--text-muted);
  font-size: 11.5px;
}

.model-editor-footer > div {
  display: flex;
  gap: 8px;
}
</style>
