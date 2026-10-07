<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CH } from '@shared/api'
import { setTheme, settingsState, updateSettings, type Theme } from '../store/settings'
import { ui } from '../store/ui'

const version = ref('')
const theme = computed(() => settingsState.value.theme)
const notifyEnabled = computed(() => settingsState.value.notifyEnabled)
const notifyAt = computed(() => settingsState.value.notifyAt)

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]

onMounted(async () => {
  const res = (await window.todoAPI.invoke(CH.appVersion)) as { ok: boolean; version?: string }
  version.value = res.ok ? (res.version ?? '') : ''
})

function onTheme(value: Theme): void {
  void setTheme(value)
}

function onNotifyToggle(event: Event): void {
  void updateSettings({ notifyEnabled: (event.target as HTMLInputElement).checked })
}

function onNotifyAt(event: Event): void {
  void updateSettings({ notifyAt: (event.target as HTMLInputElement).value })
}

function openDataDir(): void {
  void window.todoAPI.invoke(CH.storeOpenDir)
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" data-testid="settings-dialog" @click.self="ui.settingsOpen = false">
      <div class="dialog" @keydown.esc="ui.settingsOpen = false">
        <h2>设置</h2>

        <section class="block">
          <div class="lbl">主题</div>
          <div class="seg">
            <button
              v-for="t in THEMES"
              :key="t.value"
              class="seg-btn"
              :class="{ active: theme === t.value }"
              :data-theme-opt="t.value"
              @click="onTheme(t.value)"
            >
              {{ t.label }}
            </button>
          </div>
        </section>

        <section class="block">
          <div class="lbl">到期提醒</div>
          <label class="inline">
            <input type="checkbox" data-testid="notify-toggle" :checked="notifyEnabled" @change="onNotifyToggle" />
            <span>每天到点提醒未完成任务</span>
          </label>
          <label class="inline">
            <span class="dim">提醒时间</span>
            <input type="time" data-testid="notify-at" :value="notifyAt" :disabled="!notifyEnabled" @change="onNotifyAt" />
          </label>
        </section>

        <section class="block">
          <div class="lbl">数据</div>
          <button class="btn" @click="openDataDir">打开数据目录</button>
        </section>

        <div class="foot">
          <span class="dim">迷你待办 {{ version }}</span>
          <span class="spacer" />
          <button class="btn" data-testid="settings-close" @click="ui.settingsOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  width: 380px;
  padding: 18px 20px 14px;
  border-radius: 10px;
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 12px 40px rgb(0 0 0 / 25%);
}

h2 {
  margin: 0 0 14px;
  font-size: 15px;
}

.block {
  margin-bottom: 16px;
}

.lbl {
  margin-bottom: 6px;
  color: var(--text-dim);
  font-size: 12px;
}

.seg {
  display: flex;
  gap: 0;
  border: 1px solid var(--field-line);
  border-radius: 6px;
  overflow: hidden;
}

.seg-btn {
  flex: 1 1 0;
  padding: 6px 0;
  color: var(--text);
}

.seg-btn + .seg-btn {
  border-left: 1px solid var(--field-line);
}

.seg-btn.active {
  background: var(--accent);
  color: #fff;
}

.inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.dim {
  color: var(--text-dim);
}

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spacer {
  flex: 1 1 auto;
}

.btn {
  padding: 5px 14px;
  border-radius: 6px;
  border: 1px solid var(--field-line);
  background: var(--card);
}

.btn:hover {
  background: var(--hover);
}
</style>
