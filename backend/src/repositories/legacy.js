// Maps the tables the Python Lambdas used onto the data model
// (docs/database-architecture.md §7), writing through the repositories so it
// works for DynamoDB and Postgres alike. Used by `npm run migrate:legacy`, the
// parity check's fixture and the tests.
//
// Idempotent: every write is an upsert keyed by the old ids, so it can be re-run.
// It only reads the old items it is given; nothing old is modified or deleted.
import { createHash } from 'node:crypto'
import { isoUtc, pyStr, truthy } from '../lib/py.js'
import { ROLES, compact, lower, monthOf, qKey, spKey } from './common.js'
import { assignmentRecord, classNamed } from './gradebook.js'
import {
  announcements,
  assignments,
  audit,
  classes,
  invites,
  metrics,
  papers,
  posts,
  resets,
  settings,
  submissions,
  tickets,
  users,
} from './index.js'

const ACCOUNT_STATUSES = ['invited', 'active', 'temp_password', 'suspended', 'deactivated']
const QP_STATUSES = [
  'upload_requested',
  'qp_uploaded',
  'qp_parsed',
  'rubric_generating',
  'rubric_generated',
  'ai_solution_pending_review',
  'rubric_reviewed',
  'failed',
]
const SUBMISSION_STATUSES = [
  'upload_requested',
  'answer_uploaded',
  'ocr_done',
  'corrected',
  'grading_triggered',
  'ai_graded',
  'queued_for_review',
  'teacher_reviewed',
  'published',
  'published_revised',
  'expired',
]
const RESET_STATUSES = ['pending', 'approved', 'temp_issued', 'completed', 'rejected', 'expired']

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

/** A number stored as a number or numeric string → number; anything else → undefined. */
function number(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

/** Epoch seconds/ms (or numeric string) → ISO; ISO strings pass through. */
function isoTime(value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) {
    const n = Number(value)
    return isoUtc(new Date(n > 1e12 ? n : n * 1000))
  }
  return String(value)
}

/** The fields of `item` not listed in `known` (kept in the record's `extra`). */
function leftovers(item, known) {
  const out = {}
  for (const [k, v] of Object.entries(item)) if (!known.includes(k) && v !== null && v !== undefined) out[k] = v
  return Object.keys(out).length ? out : undefined
}

async function upsert(get, create, update) {
  const existing = await get()
  return existing ? update(existing) : create()
}

export class LegacyImport {
  constructor({ log = () => {} } = {}) {
    this.log = log
    this.counts = {}
    this.warnings = []
    this.userIds = new Map() // old user_id → user_id
    this.knownUsers = new Set()
    this.assignmentCache = new Map()
  }

  count(what, n = 1) {
    this.counts[what] = (this.counts[what] ?? 0) + n
  }

  warn(message) {
    this.warnings.push(message)
    this.log(`warning: ${message}`)
  }

  userId(oldId) {
    return this.userIds.get(oldId) ?? oldId
  }

  async userExists(id) {
    if (this.knownUsers.has(id)) return true
    const found = Boolean(await users.get(id))
    if (found) this.knownUsers.add(id)
    return found
  }

  /** Everything, in dependency order. `tables` is keyed like config.legacyTables. */
  async run(tables) {
    const t = (name) => tables[name] ?? []
    await this.users(t('users'), t('adminUsers'))
    await this.assignments(t('assignments'))
    await this.grading(t('grading'), t('submissions'))
    await this.announcements(t('announcements'))
    await this.resetRequests(t('resetRequests'))
    await this.invites(t('invites'))
    await this.auditLogs(t('auditLogs'))
    await this.content(t('content'))
    await this.tickets(t('tickets'))
    await this.settings(t('settings'))
    await this.analytics(t('analytics'))
    return { counts: this.counts, warnings: this.warnings }
  }

  // ---- users + class enrolment (old Users.classes) ------------------------------------

  /** Users (login accounts) and GradeAnt_Users (admin console) merged by email. */
  async users(loginItems, adminItems) {
    const byEmail = new Map()
    for (const login of loginItems) {
      if (!truthy(login.email)) {
        this.warn(`Users item without an email skipped (${pyStr(login.user_id ?? null)})`)
        continue
      }
      byEmail.set(lower(login.email), { login })
    }
    for (const admin of adminItems) {
      const entry = truthy(admin.email)
        ? byEmail.get(lower(admin.email))
        : [...byEmail.values()].find((e) => e.login?.user_id === admin.user_id)
      if (entry) entry.admin = admin
      else if (truthy(admin.email)) byEmail.set(lower(admin.email), { admin })
      else this.warn(`GradeAnt_Users item without an email skipped (${pyStr(admin.user_id ?? null)})`)
    }

    for (const { login = {}, admin = {} } of byEmail.values()) {
      const userId = login.user_id ?? admin.user_id
      if (login.user_id && admin.user_id && login.user_id !== admin.user_id) this.userIds.set(admin.user_id, login.user_id)
      const role = login.userRole || admin.role
      if (!ROLES.includes(role)) {
        this.warn(`${login.email ?? admin.email}: role ${pyStr(role ?? null)} isn't student/teacher/admin; skipped`)
        continue
      }
      let status = oneOf(admin.status, ACCOUNT_STATUSES, 'active')
      // A login account with a password can sign in, whatever the console said.
      if (status === 'invited' && truthy(login.password)) status = 'active'
      const fields = compact({
        email: login.email ?? admin.email,
        username: admin.username || undefined,
        name: login.name ?? admin.name ?? '',
        role,
        account_status: status,
        password_hash: login.password ?? admin.password_hash,
        must_change_password: Boolean(login.must_change_password ?? admin.must_change_password ?? false),
        school: admin.school,
        phone: admin.phone || undefined,
        photo_key: login.photo_key,
        admin_level: admin.admin_level,
        settings: truthy(login.gradeant_settings) ? login.gradeant_settings : undefined,
        // (Only a recorded creation time is copied; a re-run must not move it.)
        created_at: login.created_at ?? admin.created_at ?? admin.createdAt,
        updated_at: login.updated_at,
        last_login_at: login.last_login,
      })
      try {
        await upsert(
          () => users.get(userId),
          () => users.create({ user_id: userId, created_at: isoUtc(), ...fields }),
          () => users.update(userId, fields),
        )
      } catch (err) {
        this.warn(`${fields.email}: ${err.message}`)
        continue
      }
      this.knownUsers.add(userId)
      this.count('users')
      for (const name of Array.isArray(login.classes) ? login.classes : []) {
        if (role !== 'student' || !truthy(name)) continue
        const cls = await classNamed(String(name), { by: 'migration' })
        await classes.addMember({
          class_id: cls.class_id,
          student_id: userId,
          added_by: 'migration',
          added_at: fields.created_at ?? isoUtc(),
        })
        this.count('class_members')
      }
    }
  }

  // ---- assignments → assignments + question_papers (+ classes) --------------------------

  async assignments(items) {
    for (const item of items) await this.assignment(item)
  }

  async assignment(item, { placeholder = false } = {}) {
    const known = [
      'assignment_id',
      'qp_id',
      'title',
      'class_name',
      'teacher_id',
      'due_at',
      'total_marks',
      'question_count',
      'content_status',
      'grades_status',
      'method',
      'persona',
      'partial_credit',
      'created_at',
      'questions_confirmed_at',
      'grading_started_at',
      'published_at',
      'qp_status',
      'rubric',
      'rubric_reviewed_at',
      'rubric_reviewed_by',
      'updated_at',
    ]
    const id = item.assignment_id
    const teacherId = item.teacher_id && (await this.userExists(this.userId(item.teacher_id))) ? this.userId(item.teacher_id) : undefined
    const cls = truthy(item.class_name) ? await classNamed(String(item.class_name), { teacherId, by: 'migration' }) : undefined
    const record = compact({
      qp_id: item.qp_id ?? `QP-${id}`,
      title: pyStr(item.title ?? id),
      class_id: cls?.class_id,
      class_name: cls?.name,
      teacher_id: teacherId,
      due_at: item.due_at === undefined || item.due_at === null ? undefined : pyStr(item.due_at),
      total_marks: number(item.total_marks),
      question_count: number(item.question_count),
      content_status: oneOf(item.content_status, ['draft', 'published'], placeholder ? 'draft' : 'published'),
      grades_status: oneOf(item.grades_status, ['not_started', 'ai_graded', 'teacher_reviewing', 'published'], 'not_started'),
      method: oneOf(item.method, ['ai', 'standard'], undefined),
      persona: oneOf(item.persona, ['balanced', 'strict', 'lenient'], undefined),
      partial_credit: typeof item.partial_credit === 'boolean' ? item.partial_credit : undefined,
      created_at: item.created_at ?? isoUtc(),
      questions_confirmed_at: item.questions_confirmed_at,
      grading_started_at: item.grading_started_at,
      published_at: item.published_at,
      extra: leftovers(item, known),
    })
    const paper = compact({
      assignment_id: id,
      status: oneOf(item.qp_status, QP_STATUSES, 'qp_uploaded'),
      rubric: Array.isArray(item.rubric) ? item.rubric : undefined,
      rubric_reviewed_at: item.rubric_reviewed_at,
      rubric_reviewed_by: item.rubric_reviewed_by,
      updated_at: item.updated_at ?? item.created_at,
    })
    const existing = await assignments.get(id)
    if (existing) {
      const { qp_id: _qp, created_at: createdAt, ...changes } = record
      await assignments.update(id, item.created_at ? { ...changes, created_at: createdAt } : changes)
    } else {
      await assignments.create({ assignment_id: id, ...record })
    }
    const qpId = existing?.qp_id ?? record.qp_id
    await upsert(
      () => papers.get(qpId),
      () => papers.create({ qp_id: qpId, ...paper }),
      () => papers.update(qpId, paper),
    )
    this.assignmentCache.set(id, assignmentRecord({ assignment_id: id, ...record, qp_id: qpId }, paper))
    this.count(placeholder ? 'placeholder_assignments' : 'assignments')
    return this.assignmentCache.get(id)
  }

  async assignmentFor(row) {
    const id = row.assignment_id
    if (this.assignmentCache.has(id)) return this.assignmentCache.get(id)
    const a = await assignments.get(id)
    if (a) {
      this.assignmentCache.set(id, a)
      return a
    }
    // Grades for an assignment GradeAnt_Assignments doesn't have: keep them under a
    // placeholder (a draft, so students don't get a new inbox entry).
    this.warn(`assignment ${id} is missing from GradeAnt_Assignments; created a placeholder for its grades`)
    return this.assignment({ assignment_id: id, qp_id: row.qp_id, title: id, teacher_id: row.teacher_id }, { placeholder: true })
  }

  // ---- assignment_grading + GradeAnt_Submissions → submissions, answers, questions -----

  /** Rows are grouped per (assignment, student); a group may be a single new row. */
  async grading(rows, submissionItems = []) {
    const groups = new Map()
    const group = (aid, sid) => {
      const key = `${aid}\u0000${sid}`
      if (!groups.has(key)) groups.set(key, { assignmentId: aid, studentId: sid, summary: null, details: [], stored: null })
      return groups.get(key)
    }
    for (const r of rows) {
      if (!truthy(r.assignment_id) || !truthy(r.student_id)) {
        this.warn(`grading row ${pyStr(r.evaluation_id ?? null)} has no assignment_id/student_id; skipped`)
        continue
      }
      const g = group(r.assignment_id, this.userId(r.student_id))
      if (r.type === 'summary') {
        if (g.summary) this.warn(`more than one summary row for ${r.assignment_id}/${r.student_id}; kept ${g.summary.evaluation_id}`)
        else g.summary = r
      } else g.details.push(r)
    }
    for (const s of submissionItems) {
      if (truthy(s.assignment_id) && truthy(s.student_id)) group(s.assignment_id, this.userId(s.student_id)).stored = s
    }
    for (const g of groups.values()) await this.submission(g)
  }

  async submission({ assignmentId, studentId, summary, details, stored }) {
    if (!(await this.userExists(studentId))) {
      this.warn(`grades for ${assignmentId} belong to unknown student ${studentId}; skipped`)
      return
    }
    if (!stored && !summary && !details.length) return
    const a = await this.assignmentFor(summary ?? details[0] ?? { assignment_id: assignmentId })
    const s = stored ?? {}
    const summaryKnown = [
      'evaluation_id',
      'student_id',
      'assignment_id',
      'qp_id',
      'type',
      'total_marks',
      'teacher_id',
      'timestamp',
      'updated_at',
      'created_at',
    ]
    const storedKnown = [
      'assignment_id',
      'student_id',
      'status',
      'pages',
      'submitted_at',
      'published_at',
      'reminded_at',
      'notified_at',
      'recheck',
      'recheck_status',
      'recheck_requested_at',
      'updated_at',
      'created_at',
    ]
    const extra = { ...(summary ? leftovers(summary, summaryKnown) : {}), ...(stored ? leftovers(stored, storedKnown) : {}) }
    const fields = compact({
      status: oneOf(s.status, SUBMISSION_STATUSES, undefined),
      pages: number(s.pages),
      submitted_at: isoTime(s.submitted_at),
      published_at: s.published_at,
      reminded_at: s.reminded_at,
      notified_at: s.notified_at,
      recheck: Array.isArray(s.recheck) ? s.recheck : undefined,
      recheck_status: oneOf(s.recheck_status, ['open', 'closed'], undefined),
      recheck_requested_at: s.recheck_requested_at,
      status_changed_at: s.updated_at,
      ...(summary
        ? {
            total_marks: number(summary.total_marks),
            graded_at: isoTime(summary.timestamp ?? summary.created_at),
            score_updated_at: summary.updated_at,
          }
        : {}),
      extra: Object.keys(extra).length ? extra : undefined,
    })
    const existing = await submissions.getFor(a.assignment_id, studentId)
    let sub
    if (existing) {
      sub = await submissions.update(existing.submission_id, fields)
    } else {
      // The summary's evaluation_id becomes the submission id (the API exposes it);
      // ungraded ones get a stable id so re-running gives the same result.
      const id = summary?.evaluation_id ?? `SUB-${createHash('sha1').update(`${a.assignment_id}|${studentId}`).digest('hex').slice(0, 10)}`
      sub = await submissions.create({
        submission_id: String(id),
        assignment_id: a.assignment_id,
        qp_id: a.qp_id,
        student_id: studentId,
        created_at: s.created_at ?? isoTime(details[0]?.timestamp) ?? isoUtc(),
        ...fields,
      })
    }
    this.count('submissions')
    if (details.length) await this.answers(a, sub, details)
  }

  async answers(a, sub, rows) {
    const known = [
      'evaluation_id',
      'student_id',
      'assignment_id',
      'qp_id',
      'type',
      'question_number',
      'subpart',
      'question',
      'question_is_latex',
      'question_confidence',
      'question_reviewed_by',
      'question_reviewed_at',
      'max_marks',
      'marks',
      'student_answer',
      'is_latex',
      'feedback',
      'confidence',
      'status',
      'corrected_by',
      'corrected_at',
      'flag_resolved_at',
      'flag_resolved_by',
      'flag_resolution',
      'teacher_id',
      'timestamp',
      'created_at',
      'updated_at',
    ]
    const stored = new Set((await papers.questions(a.qp_id)).map((q) => `${qKey(q.question_number)}\u0000${spKey(q.subpart)}`))
    for (const r of rows) {
      if (r.question_number === undefined || r.question_number === null) {
        this.warn(`grading row ${pyStr(r.evaluation_id ?? null)} has no question_number; skipped`)
        continue
      }
      const subpart = truthy(r.subpart) ? String(r.subpart) : undefined
      // Question text was copied onto every student's row; the first copy becomes the question.
      const key = `${qKey(r.question_number)}\u0000${spKey(subpart)}`
      if (!stored.has(key)) {
        await papers.putQuestion(
          compact({
            qp_id: a.qp_id,
            question_number: r.question_number,
            subpart,
            question: r.question,
            is_latex: typeof r.question_is_latex === 'boolean' ? r.question_is_latex : undefined,
            max_marks: number(r.max_marks),
            ocr_confidence: number(r.question_confidence),
            reviewed_by: r.question_reviewed_by,
            reviewed_at: r.question_reviewed_at,
          }),
        )
        stored.add(key)
        this.count('questions')
      }
      const extra = leftovers(r, known)
      await submissions.putAnswer(
        compact({
          answer_id: String(r.evaluation_id),
          submission_id: sub.submission_id,
          question_number: r.question_number,
          subpart,
          status: r.status === undefined ? undefined : pyStr(r.status),
          student_answer: r.student_answer === undefined || r.student_answer === null ? undefined : pyStr(r.student_answer),
          is_latex: typeof r.is_latex === 'boolean' ? r.is_latex : undefined,
          max_marks: number(r.max_marks),
          marks: number(r.marks),
          feedback: r.feedback === undefined || r.feedback === null ? undefined : pyStr(r.feedback),
          confidence: number(r.confidence),
          corrected_by: r.corrected_by,
          corrected_at: r.corrected_at,
          flag_resolved_at: r.flag_resolved_at,
          flag_resolved_by: r.flag_resolved_by,
          flag_resolution: r.flag_resolution,
          created_at: isoTime(r.timestamp ?? r.created_at),
          updated_at: r.updated_at,
          extra: r.type !== undefined && r.type !== 'detail' ? { ...(extra ?? {}), type: r.type } : extra,
        }),
      )
      this.count('answers')
    }
  }

  // ---- the rest ------------------------------------------------------------------------

  async announcements(items) {
    for (const item of items) {
      if (!truthy(item.announcement_id) || !truthy(item.class_name)) continue
      if (await announcements.get(item.announcement_id)) continue
      const cls = await classes.getByName(String(item.class_name))
      const authorId = item.author_id && (await this.userExists(this.userId(item.author_id))) ? this.userId(item.author_id) : undefined
      await announcements.create(
        compact({
          announcement_id: item.announcement_id,
          class_id: cls?.class_id,
          class_name: String(item.class_name),
          title: pyStr(item.title ?? ''),
          message: pyStr(item.message ?? ''),
          author_id: authorId,
          author_name: item.author_name,
          created_at: item.created_at ?? isoUtc(),
        }),
      )
      this.count('announcements')
    }
  }

  async resetRequests(items) {
    for (const r of items) {
      const userId = this.userId(r.user_id)
      if (!(await this.userExists(userId))) {
        this.warn(`reset request ${r.request_id} is for unknown user ${r.user_id}; skipped`)
        continue
      }
      const fields = compact({
        user_id: userId,
        user_name: r.user_name,
        user_email: r.user_email,
        role: r.role,
        reason: r.reason,
        source: r.source,
        status: oneOf(r.status, RESET_STATUSES, 'pending'),
        requested_at: number(r.requested_at) ?? 0,
        decided_by: r.approved_by ?? r.decided_by,
      })
      await upsert(
        () => resets.get(r.request_id),
        () => resets.create({ request_id: r.request_id, ...fields }),
        () => resets.update(r.request_id, fields),
      )
      this.count('reset_requests')
    }
  }

  async invites(items) {
    for (const i of items) {
      const userId = this.userId(i.user_id)
      if (!(await this.userExists(userId))) {
        this.warn(`invite for unknown user ${i.user_id} skipped`)
        continue
      }
      const fields = compact({
        user_id: userId,
        full_name: i.full_name,
        role: i.role,
        class_name: i.class_name,
        expires_at: number(i.expires_at) ?? 0,
        consumed: Boolean(i.consumed),
      })
      await upsert(
        () => invites.get(i.token),
        () => invites.create({ token: i.token, ...fields }),
        () => invites.update(i.token, fields),
      )
      this.count('invites')
    }
  }

  async auditLogs(items) {
    for (const e of items) {
      const ts = number(e.timestamp) ?? 0
      await audit.append(
        compact({
          event_id: String(e.log_id),
          month: monthOf(ts),
          ts,
          actor_id: e.actor === undefined ? undefined : pyStr(e.actor),
          action: pyStr(e.action ?? ''),
          target_id: e.target === undefined ? undefined : pyStr(e.target),
        }),
      )
      this.count('audit_log')
    }
  }

  async content(items) {
    for (const p of items) {
      const fields = compact({
        title: p.title,
        author: p.author,
        date_label: p.date_label,
        status: oneOf(p.status, ['draft', 'pending', 'published'], 'draft'),
      })
      try {
        await posts.create({ post_id: p.post_id, ...fields })
      } catch (err) {
        if (err.name !== 'DuplicateError') throw err
        await posts.update(p.post_id, fields)
      }
      this.count('content_posts')
    }
  }

  async tickets(items) {
    for (const t of items) {
      const fields = compact({
        priority: t.priority,
        subject: t.subject,
        age_label: t.age_label,
        requester_name: t.requester_name,
        assignee_id: t.assignee_id,
        assignee_name: t.assignee_name,
        status: oneOf(t.status, ['open', 'resolved'], 'open'),
      })
      try {
        await tickets.create({ ticket_id: t.ticket_id, ...fields })
      } catch (err) {
        if (err.name !== 'DuplicateError') throw err
        await tickets.update(t.ticket_id, fields)
      }
      this.count('tickets')
    }
  }

  async settings(items) {
    for (const { setting_key: key, ...data } of items) {
      await settings.put(key, data)
      this.count('platform_settings')
    }
  }

  async analytics(items) {
    for (const m of items) {
      await metrics.put(m.metric_key, typeof m.data_json === 'string' ? m.data_json : JSON.stringify(m.data_json ?? {}))
      this.count('analytics_snapshots')
    }
  }
}

/** Imports old-format tables (keyed like config.legacyTables) into the current database. */
export const importLegacy = (tables, options) => new LegacyImport(options).run(tables)
