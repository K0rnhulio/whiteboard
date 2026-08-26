/**
 * Automatically optimizes and compresses pasted images / screenshots
 * Converts large uncompressed screenshots (e.g. 10MB PNGs) down to ultra-compact, high-quality images (150KB-300KB)
 * so whiteboards can hold unlimited screenshots without hitting network limits or lagging.
 */
export async function optimizeImageForWhiteboard(
  dataURL: string,
  maxDimension = 1920,
  quality = 0.85
): Promise<{ dataURL: string; mimeType: string; width: number; height: number }> {
  return new Promise((resolve) => {
    // If it's already a tiny string or SVG, keep as is
    if (dataURL.length < 40 * 1024 || dataURL.startsWith('data:image/svg+xml')) {
      const img = new Image();
      img.onload = () => {
        resolve({
          dataURL,
          mimeType: dataURL.split(';')[0].replace('data:', '') || 'image/png',
          width: img.naturalWidth || 600,
          height: img.naturalHeight || 400,
        });
      };
      img.onerror = () => {
        resolve({ dataURL, mimeType: 'image/png', width: 600, height: 400 });
      };
      img.src = dataURL;
      return;
    }

    const img = new Image();
    img.onload = () => {
      let width = img.naturalWidth || 600;
      let height = img.naturalHeight || 400;

      // Scale down proportionally if larger than maxDimension (1920px is crisp Full HD)
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataURL, mimeType: 'image/png', width, height });
        return;
      }

      // Check if original is PNG
      const isPng = dataURL.startsWith('data:image/png');

      // For JPEG conversion, fill white background in case of transparent screenshot
      if (!isPng) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      // High-quality JPEG compression
      const mimeType = 'image/jpeg';
      let compressedDataURL = canvas.toDataURL(mimeType, quality);

      // If output is somehow larger, keep original
      if (compressedDataURL.length > dataURL.length && isPng) {
        compressedDataURL = dataURL;
      }

      resolve({
        dataURL: compressedDataURL,
        mimeType,
        width,
        height,
      });
    };

    img.onerror = () => {
      resolve({ dataURL, mimeType: 'image/png', width: 600, height: 400 });
    };

    img.src = dataURL;
  });
}
