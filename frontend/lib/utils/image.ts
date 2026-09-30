/**
 * Image processing utilities for client-side preparation.
 */

const MAX_ROTATION_DIMENSION = 3072;

/**
 * Rotates an image File by the specified degrees (e.g. 90, 180, 270)
 * using an off-screen HTMLCanvasElement and returns a new File object with
 * physically rotated bitmap data.
 *
 * Bounds dimensions to MAX_ROTATION_DIMENSION to prevent mobile browser
 * canvas buffer / GPU memory exhaustion on large smartphone photos.
 *
 * @param file The original image file (JPEG or PNG).
 * @param degrees The rotation in degrees clockwise (multiples of 90).
 * @returns A Promise resolving to the physically rotated File object.
 */
export async function rotateImageFile(
  file: File,
  degrees: number
): Promise<File> {
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  if (normalizedDegrees === 0) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = (canvas?: HTMLCanvasElement) => {
      URL.revokeObjectURL(objectUrl);
      img.src = "";
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };

    img.onload = () => {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;

      if (!naturalW || !naturalH) {
        cleanup();
        reject(new Error("Image has invalid zero dimensions."));
        return;
      }

      // Constrain max dimension to prevent mobile canvas GPU/RAM memory failure
      const maxDim = Math.max(naturalW, naturalH);
      const scale = maxDim > MAX_ROTATION_DIMENSION ? MAX_ROTATION_DIMENSION / maxDim : 1;
      const targetW = Math.round(naturalW * scale);
      const targetH = Math.round(naturalH * scale);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup(canvas);
        reject(new Error("Could not get canvas context for image rotation."));
        return;
      }

      const isPerpendicular =
        normalizedDegrees === 90 || normalizedDegrees === 270;
      canvas.width = isPerpendicular ? targetH : targetW;
      canvas.height = isPerpendicular ? targetW : targetH;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Move context origin to center of rotated canvas and draw
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalizedDegrees * Math.PI) / 180);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

      const createBlob = (quality: number): Promise<Blob | null> =>
        new Promise((res) => {
          try {
            canvas.toBlob((b) => res(b), mimeType, quality);
          } catch {
            res(null);
          }
        });

      createBlob(0.92)
        .then(async (blob) => {
          if (!blob && mimeType === "image/jpeg") {
            // Fallback retry with slightly lower quality if high quality failed on mobile
            return await createBlob(0.85);
          }
          return blob;
        })
        .then((blob) => {
          cleanup(canvas);
          if (!blob) {
            reject(new Error("Canvas toBlob failed during image rotation."));
            return;
          }
          const rotatedFile = new File([blob], file.name, {
            type: mimeType,
            lastModified: Date.now(),
          });
          resolve(rotatedFile);
        })
        .catch((err) => {
          cleanup(canvas);
          reject(err);
        });
    };

    img.onerror = () => {
      cleanup();
      reject(new Error("Failed to load image file for rotation."));
    };

    img.src = objectUrl;
  });
}

