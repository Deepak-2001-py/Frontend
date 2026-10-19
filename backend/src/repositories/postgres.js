// Development data store: the local Supabase Postgres database
// (supabase/migrations/). Same interface and records as dynamodb.js.
// `pg` is a development dependency, loaded only when DB_DRIVER=postgres.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import config from '../config/index.js'
import { DuplicateError, assertColumns, compact, conditionFailed, jsonColumns, lower, qKey, spKey } from './common.js'

let pool

async function init() {
  if (pool) return
  const { default: pg } = await import('pg')
  pool = new pg.Pool({ connectionString: config.database.url, max: 5 })
  try {
    await pool.query('select 1 from users limit 0')
  } catch (err) {
    if (err.code !== '42P01') throw err
    throw new Error(
      'The GradeAnt tables are missing from DATABASE_URL. Apply supabase/migrations: `npx supabase db reset` ' +
        '(or `npx supabase start` on a fresh stack).',
    )
  }
}

async function close() {
  await pool?.end()
  pool = undefined
}

const rows = async (text, params = []) => (await pool.query(text, params)).rows

/** A row as a record: generated key columns dropped, unset fields omitted. */
function record(row) {
  if (!row) return undefined
  const { q_key: _q, sp_key: _s, ...rest } = row
  return compact(rest)
}

const param = (table, column, value) =>
  jsonColumns(table).has(column) && value !== null && value !== undefined ? JSON.stringify(value) : value

/** Inserts `values`; with `upsert` (a conflict target), replaces the conflicting row's columns. */
async function insert(table, values, { upsert, duplicateMessage = 'Already exists.' } = {}) {
  assertColumns(table, values)
  const cols = Object.keys(values).filter((c) => values[c] !== undefined)
  const params = cols.map((c) => param(table, c, values[c]))
  let text = `insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`
  if (upsert) text += ` on conflict ${upsert} do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`
  try {
    return record((await rows(`${text} returning *`, params))[0])
  } catch (err) {
    if (err.code === '23505') throw new DuplicateError(duplicateMessage)
    throw err
  }
}

/**
 * Updates the rows matching `where` ({ column: value }, plus raw `and` SQL);
 * null fields are cleared. No matching row → ConditionalCheckFailedException.
 */
async function update(table, where, fields, { duplicateMessage = 'Already exists.' } = {}) {
  assertColumns(table, fields)
  const params = []
  const sets = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([c, v]) => {
      params.push(param(table, c, v))
      return `${c} = $${params.length}`
    })
  const conditions = Object.entries(where).map(([c, v]) => {
    params.push(v)
    return `${c} = $${params.length}`
  })
  const text = sets.length
    ? `update ${table} set ${sets.join(', ')} where ${conditions.join(' and ')} returning *`
    : `select * from ${table} where ${conditions.join(' and ')}`
  let result
  try {
    result = await rows(text, params)
  } catch (err) {
    if (err.code === '23505') throw new DuplicateError(duplicateMessage)
    throw err
  }
  if (!result.length) throw conditionFailed()
  return result.map(record)
}

const one = async (text, params) => record((await rows(text, params))[0])
const many = async (text, params) => (await rows(text, params)).map(record)

// ---- users ------------------------------------------------------------------------------

const users = {
  get: (userId) => one('select * from users where user_id = $1', [userId]),
  getMany: (ids) => many('select * from users where user_id = any($1::text[])', [[...new Set(ids.filter(Boolean))]]),
  getByEmail: (email) => (email ? one('select * from users where lower(email) = $1', [lower(email)]) : undefined),
  create: (user) => insert('users', user, { duplicateMessage: 'An account with that email already exists.' }),
  update: async (userId, fields) =>
    (await update('users', { user_id: userId }, fields, { duplicateMessage: 'An account with that email already exists.' }))[0],
  list: ({ role } = {}) =>
    role
      ? many('select * from users where role = $1 order by lower(name), user_id', [role])
      : many('select * from users order by role, lower(name), user_id'),
}

// ---- classes and memberships ---------------------------------------------------------

const classes = {
  get: (classId) => one('select * from classes where class_id = $1', [classId]),
  getMany: (ids) => many('select * from classes where class_id = any($1::text[])', [[...new Set(ids.filter(Boolean))]]),
  getByName: (name) => one('select * from classes where lower(name) = $1', [lower(name)]),
  create: (cls) => insert('classes', cls, { duplicateMessage: `A class named ${cls.name} already exists.` }),
  update: async (classId, fields) => (await update('classes', { class_id: classId }, fields))[0],
  listByTeacher: (teacherId) => many('select * from classes where teacher_id = $1 order by class_id', [teacherId]),
  members: (classId) => many('select * from class_members where class_id = $1 order by student_id', [classId]),
  memberships: (studentId) => many('select * from class_members where student_id = $1 order by class_id', [studentId]),
  addMember: ({ class_id: classId, student_id: studentId, added_by: addedBy, added_at: addedAt }) =>
    one(
      `insert into class_members (class_id, student_id, member_status, added_by, added_at) values ($1, $2, 'enrolled', $3, $4)
       on conflict (class_id, student_id) do update set member_status = 'enrolled' returning *`,
      [classId, studentId, addedBy ?? null, addedAt],
    ),
  setMemberStatus: async (classId, studentId, status) =>
    (await update('class_members', { class_id: classId, student_id: studentId }, { member_status: status }))[0],
}

// ---- assignments, question papers, questions -------------------------------------------

const assignments = {
  get: (assignmentId) => one('select * from assignments where assignment_id = $1', [assignmentId]),
  getMany: (ids) => many('select * from assignments where assignment_id = any($1::text[])', [[...new Set(ids.filter(Boolean))]]),
  create: (a) => insert('assignments', a, { duplicateMessage: `Assignment ${a.assignment_id} already exists.` }),
  update: async (assignmentId, fields) => (await update('assignments', { assignment_id: assignmentId }, fields))[0],
  listByTeacher: (teacherId) => many('select * from assignments where teacher_id = $1 order by created_at, assignment_id', [teacherId]),
  listByClass: (classId) => many('select * from assignments where class_id = $1 order by due_at nulls last, assignment_id', [classId]),
  listAll: () => many('select * from assignments order by created_at, assignment_id'),
}

const papers = {
  get: (qpId) => one('select * from question_papers where qp_id = $1', [qpId]),
  create: (p) => insert('question_papers', p, { duplicateMessage: `Question paper ${p.qp_id} already exists.` }),
  update: async (qpId, fields, { ifStatus } = {}) =>
    (await update('question_papers', { qp_id: qpId, ...(ifStatus ? { status: ifStatus } : {}) }, fields))[0],
  questions: (qpId) => many('select * from questions where qp_id = $1 order by q_key, sp_key', [qpId]),
  putQuestion: (q) => insert('questions', q, { upsert: '(qp_id, q_key, sp_key)' }),
  async updateQuestions(qpId, questionNumber, subpart, fields) {
    const where = { qp_id: qpId, q_key: qKey(questionNumber), ...(subpart === undefined ? {} : { sp_key: spKey(subpart) }) }
    try {
      return await update('questions', where, fields)
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') return []
      throw err
    }
  },
}

// ---- submissions and answers ----------------------------------------------------------

const submissions = {
  get: (submissionId) => one('select * from submissions where submission_id = $1', [submissionId]),
  getFor: (assignmentId, studentId) =>
    one('select * from submissions where assignment_id = $1 and student_id = $2', [assignmentId, studentId]),
  create: (s) => insert('submissions', s, { duplicateMessage: 'This student already has a submission for this assignment.' }),
  update: async (submissionId, fields) => (await update('submissions', { submission_id: submissionId }, fields))[0],
  listByStudent: (studentId) => many('select * from submissions where student_id = $1 order by created_at, submission_id', [studentId]),
  async grid(assignmentId) {
    const [subs, answers] = await Promise.all([
      many('select * from submissions where assignment_id = $1 order by student_id', [assignmentId]),
      many(
        `select a.* from answers a join submissions s using (submission_id)
         where s.assignment_id = $1 order by s.student_id, a.q_key, a.sp_key`,
        [assignmentId],
      ),
    ])
    return { submissions: subs, answers }
  },
  answers: (submissionId) => many('select * from answers where submission_id = $1 order by q_key, sp_key', [submissionId]),
  getAnswer: (answerId) => one('select * from answers where answer_id = $1', [answerId]),
  async putAnswer(answer) {
    try {
      return await insert('answers', answer, { upsert: '(submission_id, q_key, sp_key)' })
    } catch (err) {
      if (err.code === '23503') throw conditionFailed(`No submission ${answer.submission_id}`)
      throw err
    }
  },
  updateAnswer: async (answerId, fields, { questionNumber } = {}) =>
    (await update('answers', { answer_id: answerId, ...(questionNumber === undefined ? {} : { q_key: qKey(questionNumber) }) }, fields))[0],
}

// ---- password resets, invites, audit log ----------------------------------------------

const resets = {
  get: (requestId) => one('select * from reset_requests where request_id = $1', [requestId]),
  create: (r) => insert('reset_requests', r),
  update: async (requestId, fields) => (await update('reset_requests', { request_id: requestId }, fields))[0],
  listByStatus: (status) => many('select * from reset_requests where status = $1 order by requested_at desc, request_id', [status]),
  openForUser: (userId) =>
    many("select * from reset_requests where user_id = $1 and status in ('pending', 'approved') order by requested_at desc", [userId]),
}

const invites = {
  get: (token) => one('select * from invites where token = $1', [token]),
  create: (i) => insert('invites', i, { duplicateMessage: 'Invite token already exists.' }),
  update: async (token, fields) => (await update('invites', { token }, fields))[0],
}

const audit = {
  append: (e) => insert('audit_log', e),
  recent: ({ limit = 200 } = {}) => many('select * from audit_log order by ts desc, event_id limit $1', [limit]),
}

// ---- announcements ---------------------------------------------------------------------

const announcements = {
  get: (id) => one('select * from announcements where announcement_id = $1', [id]),
  create: (a) => insert('announcements', a),
  delete: (id) => rows('delete from announcements where announcement_id = $1', [id]),
  listByClassNames: (names) =>
    many('select * from announcements where lower(class_name) = any($1::text[]) order by created_at desc', [
      [...new Set(names.map(lower))],
    ]),
  listByAuthor: (authorId) => many('select * from announcements where author_id = $1 order by created_at desc', [authorId]),
  listAll: () => many('select * from announcements order by created_at desc'),
}

// ---- admin console: content posts, tickets, settings, analytics -------------------------

const posts = {
  create: (p) => insert('content_posts', p),
  list: ({ status } = {}) =>
    status
      ? many('select * from content_posts where status = $1 order by post_id', [status])
      : many('select * from content_posts order by post_id'),
  update: async (postId, fields) => (await update('content_posts', { post_id: postId }, fields))[0],
}

const tickets = {
  create: (t) => insert('tickets', t),
  list: ({ status, assigneeId } = {}) => {
    const where = []
    const params = []
    if (status) where.push(`status = $${params.push(status)}`)
    if (assigneeId) where.push(`assignee_id = $${params.push(assigneeId)}`)
    return many(`select * from tickets${where.length ? ` where ${where.join(' and ')}` : ''} order by ticket_id`, params)
  },
  update: async (ticketId, fields) => (await update('tickets', { ticket_id: ticketId }, fields))[0],
}

const settings = {
  get: (key) => one('select * from platform_settings where setting_key = $1', [key]),
  put: (key, data) => insert('platform_settings', { setting_key: key, data }, { upsert: '(setting_key)' }),
}

const metrics = {
  get: (key) => one('select * from analytics_snapshots where metric_key = $1', [key]),
  put: (key, dataJson) => insert('analytics_snapshots', { metric_key: key, data_json: dataJson }, { upsert: '(metric_key)' }),
}

// ---- development / test helpers ----------------------------------------------------------

const MIGRATIONS = path.join(config.root, '..', 'supabase', 'migrations')

/** Creates the tables (applies supabase/migrations) in an empty database. */
export async function applyMigrations() {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: config.database.url })
  await client.connect()
  try {
    const exists = (await client.query("select to_regclass('public.users') as t")).rows[0].t
    if (exists) return
    for (const file of readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await client.query(readFileSync(path.join(MIGRATIONS, file), 'utf8'))
    }
  } finally {
    await client.end()
  }
}

/** Empties every table (tests). */
export async function truncateAll() {
  await rows(
    `truncate users, classes, class_members, assignments, question_papers, questions, submissions, answers,
     reset_requests, invites, audit_log, announcements, content_posts, tickets, platform_settings, analytics_snapshots`,
  )
}

export default {
  name: 'postgres',
  init,
  close,
  ping: () => rows('select 1'),
  users,
  classes,
  assignments,
  papers,
  submissions,
  resets,
  invites,
  audit,
  announcements,
  posts,
  tickets,
  settings,
  metrics,
}
