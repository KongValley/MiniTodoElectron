<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <div class="toast" data-testid="toast">{{ text }}</div>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 54px;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--text);
  color: var(--bg);
  font-size: 12px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 25%);
  z-index: 200;
  max-width: 70vw;
}
</style>
