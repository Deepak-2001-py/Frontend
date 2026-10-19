// Object storage: Amazon S3 in production (presigned URLs, so file bytes go
// straight from the browser to S3), or a local folder in development
// (STORAGE_DRIVER=local), served by routes/localStorage.routes.js with the
// same presigned-URL flow so the frontend code path is identical.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import config from '../config/index.js'

// ---- S3 ----------------------------------------------------------------------

let s3
const s3Client = () => (s3 ??= new S3Client({ region: config.aws.region }))

const s3Driver = {
  presignPut: (bucket, key, contentType, expiresIn) =>
    getSignedUrl(s3Client(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn }),
  presignGet: (bucket, key, expiresIn) =>
    getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn }),
  head: async (bucket, key) => {
    const res = await s3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { contentLength: res.ContentLength ?? 0, contentType: res.ContentType }
  },
  delete: (bucket, key) => s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
}

// ---- Local folder (development) -------------------------------------------------

// Per-process signing key: local URLs stop working when the dev server restarts.
const localKey = randomBytes(32)
export const LOCAL_STORAGE_ROUTE = '/_local-storage'

const localPath = (bucket, key) => {
  const root = path.join(config.storage.localDir, bucket)
  const file = path.resolve(root, key)
  if (!file.startsWith(root + path.sep)) throw new Error('Invalid object key')
  return file
}

const sign = (op, bucket, key, exp, contentType = '') =>
  createHmac('sha256', localKey).update([op, bucket, key, exp, contentType].join('\n')).digest('hex')

function localUrl(op, bucket, key, expiresIn, contentType) {
  const exp = Math.floor(Date.now() / 1000) + expiresIn
  const base = config.server.publicUrl || `http://localhost:${config.server.port}`
  const url = new URL(`${base}${config.server.basePath}${LOCAL_STORAGE_ROUTE}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`)
  url.searchParams.set('exp', String(exp))
  url.searchParams.set('sig', sign(op, bucket, key, exp, contentType))
  return url.toString()
}

/** Checks a local storage URL's signature. Returns false when invalid or expired. */
export function verifyLocalSignature(op, bucket, key, exp, sig, contentType = '') {
  if (!sig || Number(exp) < Date.now() / 1000) return false
  const expected = Buffer.from(sign(op, bucket, key, exp, contentType))
  const given = Buffer.from(String(sig))
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export async function writeLocalObject(bucket, key, body, contentType) {
  const file = localPath(bucket, key)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, body)
  await writeFile(`${file}.__meta.json`, JSON.stringify({ contentType }))
}

export async function readLocalObject(bucket, key) {
  const file = localPath(bucket, key)
  const meta = JSON.parse(await readFile(`${file}.__meta.json`, 'utf8').catch(() => '{}'))
  return { body: await readFile(file), contentType: meta.contentType || 'application/octet-stream' }
}

const localDriver = {
  presignPut: async (bucket, key, contentType, expiresIn) => localUrl('put', bucket, key, expiresIn, contentType),
  presignGet: async (bucket, key, expiresIn) => localUrl('get', bucket, key, expiresIn),
  head: async (bucket, key) => {
    try {
      const info = await stat(localPath(bucket, key))
      return { contentLength: info.size }
    } catch {
      const err = new Error('Not Found')
      err.name = 'NotFound'
      throw err
    }
  },
  delete: async (bucket, key) => {
    await rm(localPath(bucket, key), { force: true })
    await rm(`${localPath(bucket, key)}.__meta.json`, { force: true })
  },
}

export const storage = () => (config.drivers.storage === 's3' ? s3Driver : localDriver)
