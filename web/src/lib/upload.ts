import { API_BASE_URL } from '../config'

export const UPLOAD_LIMITS = {
  maxFileSizeMb: 10,
  allowedTypes: ['application/pdf'],
  timeoutMs: 60_000,
}

export type UploadType = 'student' | 'teacher' | 'answer'

export interface UploadMetadata {
  uploadType: UploadType
  assignmentId?: string
  courseId?: string
  qpId?: string
  studentId?: string
  files: { name: string; type: string; size: number; originalName?: string }[]
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

/** Asks the upload Lambda for one S3 presigned PUT URL per file, in order. */
export async function requestPresignedUrls(metadata: UploadMetadata): Promise<string[]> {
  let response: Response
  try {
    // No Authorization header: the /uploadpdf CORS config only ever saw
    // Content-Type from the old page, and the endpoint doesn't require it.
    response = await fetch(`${API_BASE_URL}/uploadpdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })
  } catch (err) {
    throw new Error(`Failed to connect to server: ${(err as Error).message}`)
  }
  if (!response.ok) {
    throw new Error(`Server error (${response.status}): ${await response.text()}`)
  }
  const data = (await response.json()) as { urls?: string[] }
  if (!data.urls || data.urls.length < metadata.files.length) {
    throw new Error('Server did not return an upload URL for every file')
  }
  return data.urls
}

/** PUTs a file to S3 via XHR (fetch has no upload progress events). */
export function uploadToPresignedUrl(file: File, url: string, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.timeout = UPLOAD_LIMITS.timeoutMs
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`))
    xhr.onerror = () => reject(new Error('Network error occurred'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.send(file)
  })
}
