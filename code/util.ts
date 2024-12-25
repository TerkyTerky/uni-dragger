import useTaskStore from "@/store/task";
import { upload } from "@/utils/upload";
import { ComponentInstance, ref } from "vue";

const taskStore = useTaskStore()

export interface IDrag {
  src: string;
  x: number;
  y: number;
  initialX: number;
  initialY: number;
  showButton: number;
}

export interface IDragState {
  draggingIndex: number
  highlightIndex: number
  isDragging: boolean
  isTouchEnd: boolean
  isInitialized: boolean
}

export const aspectFill = (imageWidth, imageHeight, canvasWidth, canvasHeight) => {
  const imageRate = imageWidth / imageHeight
  const canvasRate = canvasWidth / canvasHeight
  let [sx, sy, sw, sh] = []
  if (imageRate >= canvasRate) {
    sw = imageHeight * canvasRate
    sh = imageHeight
    sx = (imageWidth - sw) / 2
    sy = 0
  } else {
    sh = imageWidth / canvasRate
    sw = imageWidth
    sx = 0
    sy = (imageHeight - sh) / 2
  }
  return [sx, sy, sw, sh]
}

// 交换位置
export const swapItem = async (images: IDrag[], originIndex: number, targetIndex: number) => {
  const temp = ref('')
  temp.value = images.value[originIndex].src
  images.value[originIndex].src = images.value[targetIndex].src
  images.value[targetIndex].src = temp.value
}
// 确认拖拽到哪一个区域
export const itemMatch = (images: IDrag[], finalX: number, finalY: number, itemWidth: number, itemHeight: number) => {
  const colIndex = Math.round(finalX / itemWidth)
  const rowIndex = Math.round(finalY / itemHeight)
  const index = rowIndex * 2 + colIndex
  if (index >= 0 && index < images.value.length) {
    return index;
  }
  return -1;
}

export const drawImage = (ctx, img, index, itemWidth, itemHeight) => new Promise((res, rej) => {
  uni.getImageInfo({
    src: img.src,
    success(imageInfo) {
      const colIndex = index % 2;
      const rowIndex = Math.floor(index / 2);
      const [sx, sy, cropWidth, cropHeight] = aspectFill(imageInfo.width, imageInfo.height, itemWidth, itemHeight);
      // sx: 裁剪框右上角的x坐标，sy：裁剪框右上角的y坐标，cropWidth：裁剪框的宽度，cropHeight：裁剪框的高度
      ctx.drawImage(img.src, sx, sy, cropWidth, cropHeight, colIndex * itemWidth, rowIndex * itemHeight, itemWidth, itemHeight);
      res()
    },
    fail: (err) => {
      console.error('Failed to load image:', err);
      rej(err)
    }
  });
})

export const setCanvasToTemp = async (ctx, componentIns, uploadShowLoading, uploadHideLoading) => {
  await new Promise<void>((resolve, reject) => {
    ctx.draw(false, () => {
      uni.canvasToTempFilePath({
        canvasId: 'mergeImg',
        success(res) {
          upload({
            filePath: res.tempFilePath, uploadShowLoading, uploadHideLoading, callback: () => {
              taskStore.setRowImageFileMultiBackupPath(res.tempFilePath)
            }, maxCount: 4, isMultiSlot: true
          })
            .then(() => {
              resolve()
            })
            .catch((err) => {
              console.error('upload fail')
              reject(err)
            })
        },
        fail(err) {
          console.error('temp error', err)
        }
      }, componentIns)
    })
  })
}
