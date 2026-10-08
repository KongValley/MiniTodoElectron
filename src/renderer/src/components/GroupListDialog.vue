<script setup lang="ts">
/**
 * 分组 / 清单的新建与重命名弹窗。
 * 模板与保存流程照抄 TaskDialog：setup 里对 ui.meta 取一次性快照,
 * 靠 App.vue 上的 :key="ui.meta.seq" 强制重挂;回车保存走 IME 判定。
 */
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { LIST_COLORS } from '@shared/types'
import { addGroup, addList, renameGroup, updateList } from '@shared/store-ops'
import { mutate, state } from '../store/data'
import { closeMeta, ui, type MetaState } from '../store/ui'
import { isComposingEvent } from '../lib/keymap'

const m = ui.meta as MetaState

const form = reactive({
  name: m.name,
  gid: m.gid ?? '',
  color: m.color
})

const nameInput = ref<HTMLInputElement | null>(null)

const isGroup = computed(() => m.mode === 'new-group' || m.mode === 'edit-group')
const title = computed(() =>
  m.mode === 'new-group' ? '新建分组' : m.mode === 'edit-group' ? '重命名分组' : m.mode === 'new-list' ? '新建清单' : '编辑清单'
)
const canSave = computed(() => form.name.trim() !== '')
const groupOptions = computed(() => state.store.groups.map((g) => ({ id: g.id, name: g.name })))
/** 一个分组都没有时「所属分组」无从谈起,隐藏该下拉(清单会落在收集箱) */
const showGroup = computed(() => !isGroup.value && state.store.groups.length > 0)

onMounted(() => void nextTick(() => nameInput.value?.focus()))

/** 选词中的回车不上屏的是半成品名字,不能当保存 */
function onEnterSave(e: KeyboardEvent): void {
  if (isComposingEvent(e)) return
  save()
}

function save(): void {
  const name = form.name.trim()
  if (name === '') return
  if (m.mode === 'new-group') void mutate((s) => addGroup(s, name))
  else if (m.mode === 'edit-group') void mutate((s) => renameGroup(s, m.id as string, name))
  else if (m.mode === 'new-list') void mutate((s) => addList(s, form.gid, name, form.color))
  else void mutate((s) => updateList(s, m.id as string, { name, gid: form.gid, color: form.color }))
  closeMeta()
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" data-testid="meta-dialog" @click.self="closeMeta">
      <div class="dialog" @keydown.esc="closeMeta">
        <h2 class="dt">{{ title }}</h2>

        <label class="field">
          <span class="lbl">名称</span>
          <input ref="nameInput" v-model="form.name" data-testid="meta-name" :placeholder="isGroup ? '分组名称' : '清单名称'" @keydown.enter="onEnterSave" />
        </label>

        <label v-if="showGroup" class="field">
          <span class="lbl">所属分组</span>
          <select v-model="form.gid" data-testid="meta-group">
            <option value="">收集箱</option>
            <option v-for="g in groupOptions" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </label>

        <div v-if="!isGroup" class="field">
          <span class="lbl">颜色</span>
          <div class="swatches" data-testid="meta-color">
            <button
              v-for="c in LIST_COLORS"
              :key="c"
              class="sw"
              :class="{ on: form.color === c }"
              :style="{ background: c }"
              :data-color="c"
              :title="c"
              @click="form.color = c"
            />
          </div>
        </div>

        <div class="foot">
          <span class="spacer" />
          <button class="btn" data-testid="meta-cancel" @click="closeMeta">取消</button>
          <button class="btn primary" data-testid="meta-save" :disabled="!canSave" @click="save">保存</button>
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

.dt {
  margin: 0 0 14px;
  font-size: 15px;
}

.field {
  display: block;
  margin-bottom: 12px;
}

.lbl {
  display: block;
  margin-bottom: 5px;
  color: var(--text-dim);
  font-size: 12px;
}

.field input,
.field select {
  width: 100%;
}

.swatches {
  display: flex;
  gap: 8px;
}

.sw {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.sw.on {
  border-color: var(--text);
  box-shadow: 0 0 0 2px var(--card) inset;
}

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.spacer {
  flex: 1 1 auto;
}

.btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--field-line);
  background: var(--card);
}

.btn:hover:not(:disabled) {
  background: var(--hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
</style>