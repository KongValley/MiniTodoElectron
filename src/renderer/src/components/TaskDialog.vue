<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { today } from '@shared/dates'
import { addTodo, newId, removeTodos, setStatus, updateTodo } from '@shared/store-ops'
import {
  ACTIVE,
  DONE,
  DROPPED,
  INBOX_NAME,
  PRIO_NAME,
  REPEAT_NAME,
  STATUS_NAME,
  type Prio,
  type RepeatKind,
  type Status,
  type Subtask
} from '@shared/types'
import { mutate, state } from '../store/data'
import { closeDialog, ui } from '../store/ui'
import Icon from './Icon.vue'

const dialog = ui.dialog as { mode: 'new' | 'edit'; id?: string; presetDate?: string; presetList?: string }

const existing = dialog.mode === 'edit' ? state.store.todos.find((t) => t.id === dialog.id) : undefined

const form = reactive({
  title: existing?.title ?? '',
  note: existing?.note ?? '',
  noDate: existing ? existing.date === '' : dialog.presetDate === undefined,
  date: existing?.date && existing.date !== '' ? existing.date : (dialog.presetDate ?? today()),
  lid: existing?.lid ?? dialog.presetList ?? '',
  prio: (existing?.prio ?? 2) as Prio,
  status: (existing?.status ?? ACTIVE) as Status,
  repeat: (existing?.repeat.kind ?? 'none') as RepeatKind,
  subtasks: (existing?.subtasks ?? []).map((s) => ({ ...s })) as Subtask[]
})

const titleInput = ref<HTMLInputElement | null>(null)
const newSub = ref('')

const canSave = computed(() => form.title.trim() !== '')
const isEdit = computed(() => dialog.mode === 'edit')

const listsByGroup = computed(() =>
  state.store.groups.map((g) => ({
    group: g,
    lists: state.store.lists.filter((l) => l.gid === g.id).sort((a, b) => a.order - b.order)
  }))
)

const statusOptions = computed(() => [ACTIVE, DONE, DROPPED] as Status[])

onMounted(() => void nextTick(() => titleInput.value?.focus()))

function save(): void {
  if (!canSave.value) return
  const patch = {
    title: form.title.trim(),
    note: form.note.trim(),
    date: form.noDate ? '' : form.date,
    lid: form.lid,
    prio: form.prio,
    repeat: { kind: form.repeat },
    subtasks: form.subtasks.filter((s) => s.title.trim() !== '')
  }

  if (isEdit.value && dialog.id) {
    const id = dialog.id
    const status = form.status
    void mutate((s) => setStatus(updateTodo(s, id, patch), id, status))
  } else {
    void mutate((s) => addTodo(s, patch))
  }
  closeDialog()
}

function removeThis(): void {
  if (!dialog.id) return
  const id = dialog.id
  void mutate((s) => removeTodos(s, [id], false))
  closeDialog()
}

function addSub(): void {
  const t = newSub.value.trim()
  if (t === '') return
  form.subtasks.push({ id: newId(), title: t, done: false })
  newSub.value = ''
}

function removeSub(index: number): void {
  form.subtasks.splice(index, 1)
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" data-testid="task-dialog" @click.self="closeDialog">
      <div class="dialog" @keydown.esc="closeDialog">
        <h2 class="dt">{{ isEdit ? '编辑任务' : '新建任务' }}</h2>

        <label class="field">
          <span class="lbl">任务标题</span>
          <input ref="titleInput" v-model="form.title" data-testid="dlg-title" placeholder="要做什么？" @keydown.enter="save" />
        </label>

        <label class="field">
          <span class="lbl">备注</span>
          <textarea v-model="form.note" data-testid="dlg-note" rows="2" />
        </label>

        <div class="row2">
          <label class="inline">
            <input v-model="form.noDate" type="checkbox" data-testid="dlg-nodate" />
            <span>不排期</span>
          </label>
          <input v-model="form.date" type="date" data-testid="dlg-date" :disabled="form.noDate" />
        </div>

        <div class="row2">
          <label class="field">
            <span class="lbl">清单</span>
            <select v-model="form.lid" data-testid="dlg-list">
              <option value="">{{ INBOX_NAME }}</option>
              <optgroup v-for="entry in listsByGroup" :key="entry.group.id" :label="entry.group.name">
                <option v-for="l in entry.lists" :key="l.id" :value="l.id">{{ l.name }}</option>
              </optgroup>
            </select>
          </label>

          <label class="field">
            <span class="lbl">优先级</span>
            <select v-model.number="form.prio" data-testid="dlg-prio">
              <option :value="1">{{ PRIO_NAME[1] }}</option>
              <option :value="2">{{ PRIO_NAME[2] }}</option>
              <option :value="3">{{ PRIO_NAME[3] }}</option>
            </select>
          </label>
        </div>

        <div class="row2">
          <label v-if="isEdit" class="field">
            <span class="lbl">状态</span>
            <select v-model.number="form.status" data-testid="dlg-status">
              <option v-for="s in statusOptions" :key="s" :value="s">{{ STATUS_NAME[s] }}</option>
            </select>
          </label>

          <label class="field">
            <span class="lbl">重复</span>
            <select v-model="form.repeat" data-testid="dlg-repeat">
              <option v-for="(name, kind) in REPEAT_NAME" :key="kind" :value="kind">{{ name }}</option>
            </select>
          </label>
        </div>

        <div class="field">
          <span class="lbl">子任务</span>
          <div class="subs" data-testid="dlg-subs">
            <div v-for="(s, i) in form.subtasks" :key="s.id" class="sub-row">
              <input v-model="s.done" type="checkbox" />
              <input v-model="s.title" class="sub-title" />
              <button class="x" @click="removeSub(i)"><Icon name="close" :size="12" /></button>
            </div>
            <div class="sub-row">
              <span class="plus"><Icon name="plus" :size="13" /></span>
              <input v-model="newSub" class="sub-title" placeholder="添加子任务，回车确认" @keydown.enter.prevent="addSub" />
            </div>
          </div>
        </div>

        <div class="foot">
          <button v-if="isEdit" class="btn danger" data-testid="dlg-delete" @click="removeThis">移入回收站</button>
          <span class="spacer" />
          <button class="btn" data-testid="dlg-cancel" @click="closeDialog">取消</button>
          <button class="btn primary" data-testid="dlg-save" :disabled="!canSave" @click="save">保存</button>
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
  width: 460px;
  max-height: 90vh;
  overflow-y: auto;
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
.field select,
.field textarea {
  width: 100%;
  resize: vertical;
}

.row2 {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
}

.row2 .field {
  flex: 1 1 0;
  margin-bottom: 0;
}

.inline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  white-space: nowrap;
}

.subs {
  border: 1px solid var(--field-line);
  border-radius: 6px;
  padding: 6px;
  background: var(--field);
}

.sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.sub-title {
  flex: 1 1 auto;
  border: none;
  background: none;
  padding: 3px 4px;
}

.sub-title:focus {
  border: none;
}

.plus {
  width: 15px;
  text-align: center;
  color: var(--text-mute);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.x {
  color: var(--text-mute);
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.x:hover {
  color: var(--danger);
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

.btn.danger {
  color: var(--danger);
}

.btn.danger:hover {
  border-color: var(--danger);
}
</style>
