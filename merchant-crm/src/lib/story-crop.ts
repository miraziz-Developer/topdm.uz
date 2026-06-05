/** 9:16 story export — Instagram-style crop from pan/zoom state. */

export const STORY_ASPECT = 9 / 16;
export const STORY_EXPORT_WIDTH = 1080;
export const STORY_EXPORT_HEIGHT = 1920;

export type StoryCropState = {
  zoom: number;
  position: { x: number; y: number };
};

export function coverScale(mediaW: number, mediaH: number, frameW: number, frameH: number): number {
  return Math.max(frameW / mediaW, frameH / mediaH);
}

export function clampStoryPosition(
  position: { x: number; y: number },
  mediaW: number,
  mediaH: number,
  frameW: number,
  frameH: number,
  zoom: number,
): { x: number; y: number } {
  const scale = coverScale(mediaW, mediaH, frameW, frameH) * zoom;
  const drawnW = mediaW * scale;
  const drawnH = mediaH * scale;
  const maxX = Math.max(0, (drawnW - frameW) / 2);
  const maxY = Math.max(0, (drawnH - frameH) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, position.x)),
    y: Math.min(maxY, Math.max(-maxY, position.y)),
  };
}

export function computeStoryCropPixels(
  mediaW: number,
  mediaH: number,
  frameW: number,
  frameH: number,
  zoom: number,
  position: { x: number; y: number },
) {
  const scale = coverScale(mediaW, mediaH, frameW, frameH) * zoom;
  const drawnW = mediaW * scale;
  const drawnH = mediaH * scale;
  const cropX = (drawnW - frameW) / 2 - position.x;
  const cropY = (drawnH - frameH) / 2 - position.y;
  return {
    x: cropX / scale,
    y: cropY / scale,
    width: frameW / scale,
    height: frameH / scale,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Rasm yuklanmadi"));
    img.src = src;
  });
}

export async function exportStoryImage(
  imageSrc: string,
  frameW: number,
  frameH: number,
  state: StoryCropState,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const mediaW = image.naturalWidth;
  const mediaH = image.naturalHeight;
  const pos = clampStoryPosition(state.position, mediaW, mediaH, frameW, frameH, state.zoom);
  const crop = computeStoryCropPixels(mediaW, mediaH, frameW, frameH, state.zoom, pos);

  const canvas = document.createElement("canvas");
  canvas.width = STORY_EXPORT_WIDTH;
  canvas.height = STORY_EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas ishlamadi");

  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    STORY_EXPORT_WIDTH,
    STORY_EXPORT_HEIGHT,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Eksport xatosi"))),
      "image/jpeg",
      0.92,
    );
  });
}
