<template>
  <view id="slotContainer" class="multi-slot-container">
    <movable-area class="drag-area">
      <movable-view
        class="drag-item"
        v-for="{ item, index } in images"
        direction="all"
        :key="index"
        :x="item.x"
        :y="item.y"
        @touchstart="touchStart"
        @change=""
        @touchend=""
      >
        <image :src="item.src" mode="aspectFill" />
      </movable-view>
    </movable-area>
  </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import type { IDrag } from './util'

const images = ref<IDrag[]>([])
const isInitialized = ref(false)

const touchStart = () => {
  isInitialized.value = true
}
const touchMove = (index: number, event: TouchEvent) => {}
</script>
