/**
 * Image processing utilities for client-side preparation.
 */

/**
 * Rotates an image File by the specified degrees (e.g. 90, 180, 270)
 * using an off-screen HTMLCanvasElement and returns a new File object with
 * physically rotated bitmap data.
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

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context for image rotation."));
        return;
      }

      const isPerpendicular =
        normalizedDegrees === 90 || normalizedDegrees === 270;
      canvas.width = isPerpendicular ? img.height : img.width;
      canvas.height = isPerpendicular ? img.width : img.height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Move context origin to center of rotated canvas and draw
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalizedDegrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob failed during image rotation."));
            return;
          }
          const rotatedFile = new File([blob], file.name, {
            type: mimeType,
            lastModified: Date.now(),
          });
          resolve(rotatedFile);
        },
        mimeType,
        0.95
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image file for rotation."));
    };

    img.src = objectUrl;
  });
}
