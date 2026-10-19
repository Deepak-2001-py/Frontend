// /uploadpdf — presigned S3 PUT URLs for answer sheets and question papers.
// The original presign Lambda is not in this repository, so its S3 key layout
// is not known here: keys follow UPLOAD_KEY_TEMPLATE, and the endpoint stays
// off in production until UPLOAD_BUCKET is set. Point the template at the
// layout the grading pipeline reads before enabling it.
import { randomUUID } from 'node:crypto'
import { storage } from '../aws/s3.js'
import config from '../config/index.js'
import { HttpError, badRequest, forbidden } from '../lib/errors.js'

const ALLOWED_TYPES = new Set(['application/pdf'])
const UPLOAD_TYPES = new Set(['student', 'teacher', 'answer'])
const MAX_FILES = 20

const safe = (v) => String(v ?? '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200) || '_'

export function objectKey(meta, fileName) {
  const values = {
    uploadType: safe(meta.uploadType),
    assignmentId: safe(meta.assignmentId),
    qpId: safe(meta.qpId),
    studentId: safe(meta.studentId),
    courseId: safe(meta.courseId),
    fileName: safe(fileName),
    uuid: randomUUID(),
  }
  return config.storage.uploadKeyTemplate.replace(/\{(\w+)\}/g, (m, name) => values[name] ?? m)
}

export async function presignUploads(body, caller) {
  const bucket = config.storage.uploadBucket
  if (!bucket) throw new HttpError(503, 'File uploads are not configured on this server.')
  if (!UPLOAD_TYPES.has(body.uploadType)) throw badRequest('uploadType must be student, teacher or answer.')
  if (caller.role === 'student' && body.uploadType !== 'student') throw forbidden('Students can only upload answer sheets.')
  if (caller.role === 'student' && body.studentId && body.studentId !== caller.user_id) {
    throw forbidden('You can only upload your own answers.')
  }
  const files = Array.isArray(body.files) ? body.files : []
  if (!files.length || files.length > MAX_FILES) throw badRequest(`Send between 1 and ${MAX_FILES} files.`)
  for (const f of files) {
    if (!f || typeof f.name !== 'string' || !f.name) throw badRequest('Every file needs a name.')
    if (!ALLOWED_TYPES.has(f.type)) throw badRequest(`${f.name}: only PDF files can be uploaded.`)
    if (!(Number(f.size) > 0) || Number(f.size) > config.storage.uploadMaxBytes) {
      throw badRequest(`${f.name}: files must be under ${Math.round(config.storage.uploadMaxBytes / 1048576)} MB.`)
    }
  }
  const meta = { ...body, studentId: body.studentId ?? (caller.role === 'student' ? caller.user_id : undefined) }
  const store = storage()
  const urls = await Promise.all(
    files.map((f) => store.presignPut(bucket, objectKey(meta, f.name), f.type, config.storage.uploadUrlTtlSeconds)),
  )
  return { urls }
}
