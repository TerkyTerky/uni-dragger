<template>
  <view id="slotContainer" class="multi-slot-container">
    <movable-area v-if="!resultFlag" class="drag-area">
      <movable-view class="drag-item" v-for="(item, index) in images" direction="all" :key="index" :x="item.x"
        :y="item.y" @touchstart="touchStart" @change="touchMove(index, $event)" @touchend="touchEnd(index)"
        @click="itemClick(index)" :animation="false"
        :class="{ 'dragging': dragState.draggingIndex === index, 'highlight': dragState.highlightIndex === index && dragState.draggingIndex !== index }">
        <image :src="item.src" mode="aspectFill" :class="uploaderImageLoading && 'uploader-image-loading'" />
        <CustomButton v-if="item.showButton" class="re-choose" icon="compare" type="ghost" size="xhs-mini2"
          :iconSize="13" :onClick="() => buttonClick(index)">替换照片
        </CustomButton>
      </movable-view>
    </movable-area>
    <image v-else class="result-image" :src="resultImg" mode="aspectFill" />
    <canvas canvas-id="mergeImg" class="muti-slot-canvas"></canvas>
  </view>
  <CustomToast ref="customToast" />
</template>

<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, ref, PropType, computed, reactive } from 'vue';
import CustomButton from '@/components/button/index.vue';
import CustomToast from '@/components/custom-toast';
import { clickTracker } from '@/utils/tracker';
import { selectImgAndUpload, upload } from '@/utils/upload'
import useTaskStore from '@/store/task';
import { drawImage, IDrag, aspectFill, setCanvasToTemp, swapItem, itemMatch, IDragState } from './utils';
import { throttle } from '@/utils/throttle';
import { useUpload } from '@/composables/useUpload';

const customToast = ref()
const props = defineProps({
  urls: {
    type: Array,
    required: true
  }
});

const images = ref<IDrag[]>([]);
// 计算实际容器的宽高
const itemWidth = ref(0);
const itemHeight = ref(0);
// 记录停止拖动前最后一次偏移量
const lastPosition = ref({ x: 0, y: 0 })
const finalPosition = ref([])
const dragState = reactive<IDragState>(
  {
    // 控制拖拽时效果
    draggingIndex: -1,
    highlightIndex: -1,
    isDragging: false,
    isTouchEnd: false,
    // 为了避免初始化时触发touchmove的时候，更改了控制效果的变量
    isInitialized: false
  }
)
// 暴露给uploader的前后对比方法
const comparison = ref(false)

const taskStore = useTaskStore()
const canvasCtx = ref(null)
const componentInstance = getCurrentInstance()
const { uploadShowLoading, uploadHideLoading, multiReSelect } = useUpload(customToast)

const generateItemData = computed(
  () => taskStore.getItemDataById
);
const resultFlag = computed(() => {
  return generateItemData.value?.isSuccess
})
const resultImg = computed(() => {
  if (comparison.value || !generateItemData.value?.isSuccess) {
    return taskStore.rowImageFileMultiBackupPath[taskStore.selectTemplateId]
  }
  return generateItemData.value?.taskResultWithoutWatermarkUrl
})
const uploaderImageLoading = computed(
  () =>
    generateItemData.value?.isLoading ||
    generateItemData.value?.isSuccess === false
);

onMounted(() => {
  const query = uni.createSelectorQuery().in(getCurrentInstance())
  canvasCtx.value = uni.createCanvasContext('mergeImg', componentInstance)

  query.select('#slotContainer').boundingClientRect(data => {
    const containerWidth = data.width
    const containerHeight = data.height
    itemWidth.value = containerWidth / 2
    itemHeight.value = containerHeight / 2
  }).exec()
  initializeImage();
})

const initializeImage = async () => {
  images.value = Array.from(props.urls)[0].map(url => ({
    src: url,
    x: 0,
    y: 0,
    initialX: 0,
    initialY: 0,
    showButton: false
  }));
  // 少于4张图片
  const currentLength = images.value.length
  if (currentLength < 4) {
    // 取上传的最后一张图片的地址，复制到剩余的图片中
    const lastImg = taskStore.rowImageFileMultiPaths[taskStore.categoryId].slice(-1)[0]
    // 依据剩余图片数量，复制图片地址
    for (let i = 0; i < 4 - currentLength; i++) {
      images.value.push({
        src: lastImg,
        x: 0,
        y: 0,
        initialX: 0,
        initialY: 0,
        showButton: false
      })
    }
  }
  await initializePosition();
}
const initializePosition = async () => {
  images.value.forEach((image, index) => {
    const colIndex = index % 2;
    const rowIndex = Math.floor(index / 2);
    setTimeout(() => {
      image.x = colIndex * itemWidth.value
      image.y = rowIndex * itemHeight.value
      image.initialX = image.x
      image.initialY = image.y
    }, 100)
  })
}

const touchStart = () => {
  dragState.isInitialized = true
}
const touchMove = (index: number, event: TouchEvent) => {
  if (dragState.isTouchEnd || !dragState.isInitialized) return
  const { x, y } = event.detail
  images.value[index].x = x
  images.value[index].y = y
  lastPosition.value = { x: images.value[index].x, y: images.value[index].y }
  dragState.highlightIndex = itemMatch(images, x, y, itemWidth.value, itemHeight.value)
  dragState.draggingIndex = index
  dragState.isDragging = true
};
const touchEnd = async (index: number) => {
  dragState.isTouchEnd = true
  finalPosition.value = { ...lastPosition.value };
  const targetItemIndex = itemMatch(images, finalPosition.value.x, finalPosition.value.y, itemWidth.value, itemHeight.value);
  if (targetItemIndex !== -1 && dragState.isDragging === true) {
    await swapItem(images, index, targetItemIndex);
  }
  images.value[index].x = images.value[index].initialX;
  images.value[index].y = images.value[index].initialY;
  resetOnEnd()
}
const resetOnEnd = () => {
  dragState.highlightIndex = -1
  dragState.draggingIndex = -1
  dragState.isTouchEnd = false
  dragState.isDragging = false
  dragState.isInitialized = false
}

// 点击触发重选图片按钮，只可以有一个重选按钮显示
const itemClick = (index: number) => {
  dragState.highlightIndex = index
  images.value = images.value.map((item, i) => ({
    ...item,
    showButton: i === index ? !item.showButton : false
  }))
}
const buttonClick = async (index: number) => {
  // 打点
  clickTracker('home.reSelectBtn')
  await multiReSelect()
  images.value[index].src = taskStore.rowImageFileMultiBackupPath[taskStore.selectTemplateId]
}

const mergeHandler = throttle(async () => {
  const itemWidth = images.value[3].initialX
  const itemHeight = images.value[3].initialY
  const ctx = canvasCtx.value
  const drawTasks = images.value.map((img, index) => drawImage(ctx, img, index, itemWidth, itemHeight))
  // 画完所有图片再进入到拼图阶段
  await Promise.all(drawTasks)
  // canvas拼图，同时保存到临时路径，调用上传功能；使用promise是为了确保执行完才可以下一步
  await setCanvasToTemp(ctx, componentInstance, uploadShowLoading, uploadHideLoading)
}, 300)
// 前后对比
const compare = () => {
  comparison.value = !comparison.value
}

defineExpose({
  mergeHandler,
  compare
})
</script>

<style scoped lang="scss">
.multi-slot-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 914.66rpx;
}

.drag-area {
  position: relative;
  width: 686rpx;
  height: 914.66rpx;
  border-radius: 32rpx;
}

.drag-item {
  position: absolute;
  width: 343rpx;
  height: 457.33rpx;
  background-color: #f0f0f0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  border-radius: 32rpx;

  &.dragging {
    z-index: 10;
    opacity: 0.7;
  }

  &.highlight::before {
    content: '';
    position: absolute;
    top: 0px;
    left: 0px;
    right: 0px;
    bottom: 0px;
    border: 2px solid rgba($color: red, $alpha: 1.0);
    pointer-events: none;
  }

  .re-choose {
    position: absolute;
    bottom: 10rpx;
    /* 距离底部 10px */
    right: 10rpx;
    /* 距离右侧 10px */
    padding: 5rpx 10rpx;
  }
}

.drag-item image {
  width: 100%;
  height: 100%;
  font-size: 24px;
}

.uploader-image-loading {
  filter: blur(20rpx) brightness(75%);
}

.muti-slot-canvas {
  position: fixed;
  left: 100%;
  top: 0;
  width: 686rpx;
  height: 914.66rpx;
  z-index: -1;
}

.result-image {
  width: 686rpx;
  height: 914.66rpx;
  border-radius: 32rpx;
}
</style>
