const DEFAULTS = { maxLongEdge: 2560, quality: 0.86 };

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("WebP 변환에 실패했습니다.")), "image/webp", quality);
  });
}

async function decodeImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch (error) {
      console.warn("createImageBitmap fallback:", error);
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function optimizeImage(source, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const blob = source instanceof Blob ? source : new Blob([source]);
  if (source instanceof File && !["image/jpeg", "image/png", "image/webp"].includes(source.type)) {
    throw new Error(`${source.name}: JPG, PNG 또는 WebP 이미지만 사용할 수 있습니다.`);
  }
  if (source instanceof File && source.size > 30 * 1024 * 1024) {
    throw new Error(`${source.name}: 원본 파일은 30MB 이하여야 합니다.`);
  }
  const decoded = await decodeImage(blob);
  const scale = Math.min(1, settings.maxLongEdge / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(decoded.source, 0, 0, width, height);
  decoded.release();
  const webp = await canvasToBlob(canvas, settings.quality);
  return { blob: webp, width, height, originalBytes: blob.size, optimizedBytes: webp.size };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
