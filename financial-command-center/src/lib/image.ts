/**
 * Preparation des images avant stockage.
 *
 * Tout vit dans localStorage, dont le quota tourne autour de 5 Mo pour
 * l'origine entiere. Une photo de telephone pese 3 a 6 Mo : la stocker telle
 * quelle saturerait l'espace et ferait perdre les donnees financieres.
 * On redimensionne donc systematiquement avant d'ecrire.
 */

export const MAX_EDGE = 900
export const MAX_BYTES = 260_000

export class ImageTooLargeError extends Error {}

/** Redimensionne, recompresse en JPEG et renvoie une data URL. */
export async function prepareImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Ce fichier n’est pas une image.')
  }
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de preparer l’image.')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  // On baisse la qualite par paliers jusqu'a tenir dans le budget d'octets.
  for (const quality of [0.78, 0.66, 0.55, 0.45, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (approxBytes(url) <= MAX_BYTES) return url
  }
  throw new ImageTooLargeError(
    'Cette image reste trop lourde meme compressee. Essaie une photo plus petite.',
  )
}

/** Taille reelle d'une data URL base64, sans la reconstruire. */
export function approxBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Safari ancien : on retombe sur un <img>.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image illisible.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
