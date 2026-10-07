<script setup lang="ts">
import { ui } from '../store/ui'

function ok(): void {
  const action = ui.confirm?.onOk
  ui.confirm = null
  action?.()
}

function cancel(): void {
  ui.confirm = null
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" data-testid="confirm-dialog" @click.self="cancel">
      <div class="dialog">
        <h2>{{ ui.confirm?.title }}</h2>
        <p>{{ ui.confirm?.detail }}</p>
        <div class="foot">
          <span class="spacer" />
          <button class="btn" data-testid="confirm-cancel" @click="cancel">取消</button>
          <button class="btn danger" data-testid="confirm-ok" @click="ok">确定</button>
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
  z-index: 110;
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
  margin: 0 0 8px;
  font-size: 15px;
}

p {
  margin: 0 0 14px;
  color: var(--text-dim);
  line-height: 1.5;
}

.foot {
  display: flex;
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

.btn.danger {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
