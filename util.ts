export interface IDrag {
  src: string
  x: number
  y: number
  initialX: number
  initialY: number
}

export const aspectFill = (
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) => {
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
