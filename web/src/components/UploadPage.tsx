import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAlerts } from '../hooks/useAlerts'
import { apiCache } from '../lib/apiCache'
import {
  formatFileSize,
  renameSolutionFile,
  requestPresignedUrls,
  uploadToPresignedUrl,
  UPLOAD_LIMITS,
  type UploadMetadata,
  type UploadType,
} from '../lib/upload'
import '../styles/themes/aesthetic.css'
import '../styles/pages/upload.css'
import AlertStack from './AlertStack'
import AppShell from './AppShell'
import PageScope from './PageScope'

export interface UploadPageCopy {
  title: string
  subtitle: string
  dropLabel: string
  submitLabel: string
  types: { value: UploadType; label: string }[]
  steps: { title: string; text: string }[]
  note: string
}

interface FileProgress {
  name: string
  percent: number
  error?: string
}

const HEADINGS: Record<UploadType, string> = {
  student: 'Upload Assignment',
  teacher: 'Upload Question Paper',
  answer: 'Upload Answer Sheet',
}

const PROGRESS_HIDE_DELAY_MS = 3000

/** Shared by the student and teacher upload pages (was javascript/upload_pdf.js). */
export default function UploadPage({ copy }: { copy: UploadPageCopy }) {
  const navigate = useNavigate()
  const { alerts, show, dismiss, clear } = useAlerts()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Prefilled when opened from an assignment (e.g. the student inbox's "Start submission").
  const [params] = useSearchParams()
  const [uploadType, setUploadType] = useState<UploadType | ''>(() =>
    params.get('assignment_id') && copy.types.length === 1 ? copy.types[0].value : '',
  )
  const [assignmentId, setAssignmentId] = useState(() => params.get('assignment_id') ?? '')
  const [courseId, setCourseId] = useState(() => params.get('qp_id') ?? '')
  const [studentId, setStudentId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ percent: number; text: string } | null>(null)
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([])
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function addFiles(list: FileList | null) {
    if (!list) return
    const accepted: File[] = []
    for (const file of Array.from(list)) {
      if (!UPLOAD_LIMITS.allowedTypes.includes(file.type)) {
        show(`File ${file.name} is not a PDF`, 'danger')
      } else if (file.size > UPLOAD_LIMITS.maxFileSizeMb * 1024 * 1024) {
        show(`File ${file.name} exceeds maximum size of ${UPLOAD_LIMITS.maxFileSizeMb}MB`, 'danger')
      } else {
        accepted.push(file)
      }
    }
    setFiles((prev) => [...prev, ...accepted.filter((f) => !prev.some((p) => p.name === f.name))])
  }

  function onDrag(e: DragEvent, over: boolean) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(over)
  }

  function resetForm() {
    setUploadType('')
    setAssignmentId('')
    setCourseId('')
    setStudentId('')
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /** Validates the form and builds the presign request + the files to PUT. */
  function prepare(type: UploadType): { metadata: UploadMetadata; uploads: File[] } | null {
    const aId = assignmentId.trim()
    const qp = courseId.trim()
    if ((type === 'student' || type === 'answer') && !aId) {
      show('Please enter Assignment ID', 'danger')
      return null
    }
    if (type === 'answer' && !qp) {
      show('Please enter Question Paper ID', 'danger')
      return null
    }
    if (files.length === 0) {
      show(type === 'answer' ? 'Please select at least one answer sheet file' : 'Please select at least one file', 'danger')
      return null
    }

    const metadata: UploadMetadata = { uploadType: type, files: [] }
    if (aId) metadata.assignmentId = aId
    if (qp) metadata.courseId = qp
    if (type === 'student' && studentId.trim()) metadata.studentId = studentId.trim()

    if (type === 'answer') {
      metadata.qpId = qp
      const uploads = files.map((f) => {
        const renamed = renameSolutionFile(f, aId, qp)
        metadata.files.push({ name: renamed.name, originalName: f.name, type: renamed.type, size: renamed.size })
        return renamed
      })
      return { metadata, uploads }
    }

    metadata.files = files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
    return { metadata, uploads: files }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!uploadType) {
      show('Please select upload type', 'danger')
      return
    }
    const prepared = prepare(uploadType)
    if (!prepared) return
    const { metadata, uploads } = prepared

    clear()
    setSubmitting(true)
    setProgress({ percent: 0, text: '0%' })
    setFileProgress(uploads.map((f) => ({ name: f.name, percent: 0 })))

    let done = 0
    let failed = 0
    const updateTotal = () => {
      const percent = Math.round(((done + failed) / uploads.length) * 100)
      setProgress({ percent, text: `${percent}% (${done}/${uploads.length} files)` })
    }

    try {
      const urls = await requestPresignedUrls(metadata)
      await Promise.all(
        uploads.map(async (file, i) => {
          try {
            await uploadToPresignedUrl(file, urls[i], (percent) =>
              setFileProgress((fp) => fp.map((p, j) => (j === i ? { ...p, percent } : p))),
            )
            done++
          } catch (err) {
            failed++
            setFileProgress((fp) => fp.map((p, j) => (j === i ? { ...p, error: (err as Error).message } : p)))
          }
          updateTotal()
        }),
      )

      if (failed === 0) {
        show(uploadType === 'answer' ? 'All answer sheets uploaded successfully!' : 'All files uploaded successfully!', 'success')
        // New submission: cached assignment lists/grades are stale now.
        apiCache.clearPrefix('student-data:')
        apiCache.clearPrefix('grades:')
        resetForm()
        redirectToCorrection(metadata)
      } else {
        show(`Upload completed with ${failed} failed file(s) out of ${uploads.length}`, 'warning')
      }
    } catch (err) {
      show(`Upload failed: ${(err as Error).message}`, 'danger')
    } finally {
      setSubmitting(false)
      timers.current.push(
        window.setTimeout(() => {
          setProgress(null)
          setFileProgress([])
        }, PROGRESS_HIDE_DELAY_MS),
      )
    }
  }

  /**
   * Sends the uploader to the post-upload correction workspace so they can
   * fix whatever OCR misread; the short delay lets the success alert show.
   */
  function redirectToCorrection(metadata: UploadMetadata) {
    if (!metadata.assignmentId) return
    const params = new URLSearchParams({ assignment_id: metadata.assignmentId })
    const qp = metadata.qpId || metadata.courseId
    if (qp) params.set('qp_id', qp)
    const target =
      metadata.uploadType === 'student' ? '/student/answer-correction' : '/teacher/question-correction'
    timers.current.push(window.setTimeout(() => navigate(`${target}?${params}`), 1500))
  }

  return (
    <PageScope name="upload" theme="aesthetic" title={copy.title}>
      <AppShell footer={false}>
        <main className="main-content">
          <div className="container">
            <section className="tab-content active">
              <div className="card">
                <div className="card-header">
                  <span className="header-icon-badge">
                    <i className="fas fa-file-upload" />
                  </span>
                  <h2>{uploadType ? HEADINGS[uploadType] : copy.title}</h2>
                  <p>{copy.subtitle}</p>
                </div>
                <div className="card-body">
                  <div className="upload-layout">
                    <div className="upload-main">
                      <form className="form" onSubmit={handleSubmit} noValidate>
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="upload-type">Upload Type</label>
                            <select
                              id="upload-type"
                              className="form-control"
                              value={uploadType}
                              onChange={(e) => setUploadType(e.target.value as UploadType | '')}
                            >
                              <option value="">Select Upload Type</option>
                              {copy.types.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label htmlFor="assignment-id">Assignment ID</label>
                            <input
                              type="text"
                              id="assignment-id"
                              className="form-control"
                              placeholder="e.g. assignment456"
                              value={assignmentId}
                              onChange={(e) => setAssignmentId(e.target.value)}
                            />
                          </div>
                          {uploadType === 'student' && (
                            <div className="form-group student-id-container">
                              <label htmlFor="student-id">Student ID</label>
                              <input
                                type="text"
                                id="student-id"
                                className="form-control"
                                placeholder="Enter your student ID"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label htmlFor="course-id">Question Paper ID</label>
                          <input
                            type="text"
                            id="course-id"
                            className="form-control"
                            placeholder="e.g. physics_101"
                            value={courseId}
                            onChange={(e) => setCourseId(e.target.value)}
                          />
                        </div>

                        <div
                          className={`file-upload${dragOver ? ' drag-over' : ''}`}
                          onDragEnter={(e) => onDrag(e, true)}
                          onDragOver={(e) => onDrag(e, true)}
                          onDragLeave={(e) => onDrag(e, false)}
                          onDrop={(e) => {
                            onDrag(e, false)
                            addFiles(e.dataTransfer.files)
                          }}
                        >
                          <label htmlFor="file-input" className="file-upload-label">
                            <span className="upload-icon-circle">
                              <i className="fas fa-cloud-upload-alt" />
                            </span>
                            <span>{copy.dropLabel}</span>
                          </label>
                          <input
                            ref={fileInputRef}
                            type="file"
                            id="file-input"
                            className="file-input"
                            accept=".pdf"
                            multiple
                            onChange={(e) => {
                              addFiles(e.target.files)
                              e.target.value = ''
                            }}
                          />
                          <div className="upload-specs">
                            <span className="spec-item">PDF only</span>
                            <span className="spec-item">·</span>
                            <span className="spec-item">up to {UPLOAD_LIMITS.maxFileSizeMb} MB</span>
                            <span className="spec-item">·</span>
                            <span className="spec-item">multi-page supported</span>
                          </div>
                        </div>

                        <div className="file-list-container">
                          <ul className="file-list">
                            {files.map((f) => (
                              <li key={f.name}>
                                <span className="file-name">{f.name}</span>
                                <span className="file-size">{formatFileSize(f.size)}</span>
                                <button
                                  type="button"
                                  className="remove-file"
                                  onClick={() => setFiles((fs) => fs.filter((x) => x !== f))}
                                >
                                  &times;
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {progress && (
                          <div className="progress-container" style={{ display: 'block' }}>
                            <div className="progress">
                              <div
                                className="progress-bar"
                                role="progressbar"
                                aria-valuenow={progress.percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                style={{ width: `${progress.percent}%` }}
                              />
                            </div>
                            <p className="progress-text">{progress.text}</p>
                            {fileProgress.map((fp) => (
                              <div key={fp.name} className={`file-progress${fp.error ? ' upload-failed' : ''}`}>
                                <p>
                                  {fp.name} ({fp.error ? `Failed: ${fp.error}` : `${fp.percent}%`})
                                </p>
                                <div className="progress">
                                  <div className="progress-bar" style={{ width: `${fp.percent}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <AlertStack alerts={alerts} onDismiss={dismiss} />

                        <div className="form-actions">
                          <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? (
                              'Uploading...'
                            ) : (
                              <>
                                <i className="fas fa-upload" /> {copy.submitLabel}
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                    <aside className="upload-aside">
                      <h3>How it works</h3>
                      <div className="upload-steps">
                        {copy.steps.map((s, i) => (
                          <div className="upload-step" key={s.title}>
                            <span className="step-num">{i + 1}</span>
                            <p>
                              <strong>{s.title}</strong>
                              {s.text}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="upload-aside-note">
                        <i className="fas fa-circle-info" />
                        <span>{copy.note}</span>
                      </div>
                    </aside>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </AppShell>
    </PageScope>
  )
}
