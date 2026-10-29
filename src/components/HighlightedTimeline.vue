<script setup lang="ts">
import { computed } from 'vue'
import { highlightTimeline } from '../lib/highlight'

const props = defineProps<{ text: string }>()

const lines = computed(() => highlightTimeline(props.text))
</script>

<template>
  <div class="timeline-view" tabindex="0" role="textbox" aria-readonly="true" aria-multiline="true" aria-label="換算結果">
    <div v-for="(tokens, i) in lines" :key="i" class="timeline-line">
      <template v-for="(t, j) in tokens" :key="j">
        <span v-if="t.type === 'time'" class="tl-time">{{ t.text }}</span>
        <span v-else-if="t.type === 'ox'" class="tl-ox"
          ><span v-for="(c, k) in t.text" :key="k" :class="{ 'tl-changed': t.changed[k] }">{{ c }}</span></span
        >
        <span v-else-if="t.type === 'auto'" :class="{ 'tl-changed': t.changed }">{{ t.text }}</span>
        <template v-else>{{ t.text }}</template>
      </template>
      <br v-if="!tokens.length" />
    </div>
  </div>
</template>
