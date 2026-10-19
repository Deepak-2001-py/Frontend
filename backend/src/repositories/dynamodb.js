// Production data store: the DynamoDB tables of docs/database-architecture.md §2.
// Same interface and records as postgres.js.
import { BatchGetCommand, DeleteCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { closeDynamo, connectDynamo, dynamo, queryAll, scanAll } from '../aws/dynamodb.js'
import config from '../config/index.js'
import { DuplicateError, ROLES, assertColumns, compact, conditionFailed, lower, qKey, sortableEpoch, spKey } from './common.js'

const T = () => config.tables
const INDEX_ATTRS = ['gsi1pk', 'gsi1sk', 'gsi2pk', 'gsi2sk', 'gsi3pk', 'gsi3sk']
const KEY_ATTRS = ['pk', 'sk', ...INDEX_ATTRS]
const send = (command) => dynamo().send(command)
const isConditionFailure = (err) => err?.name === 'ConditionalCheckFailedException'

/** An item as a record: key attributes (and any `hidden` ones) removed. */
function strip(item, hidden = []) {
  if (!item) return undefined
  const out = { ...item }
  for (const k of [...KEY_ATTRS, ...hidden]) delete out[k]
  return compact(out)
}

async function getItem(TableName, pk, sk) {
  return (await send(new GetCommand({ TableName, Key: { pk, sk }, ConsistentRead: true }))).Item
}

/** Query a table (or GSI `index`) by partition key, optionally by sort-key prefix. */
function query(TableName, { index, pk, prefix, forward = true }) {
  const names = { '#p': index ? `${index}pk` : 'pk' }
  const values = { ':p': pk }
  let condition = '#p = :p'
  if (prefix !== undefined) {
    names['#s'] = index ? `${index}sk` : 'sk'
    values[':s'] = prefix
    condition += ' AND begins_with(#s, :s)'
  }
  return queryAll({
    TableName,
    ...(index ? { IndexName: index } : {}),
    KeyConditionExpression: condition,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ScanIndexForward: forward,
  })
}

async function putNew(TableName, item, duplicateMessage) {
  try {
    await send(new PutCommand({ TableName, Item: item, ConditionExpression: 'attribute_not_exists(pk)' }))
  } catch (err) {
    if (isConditionFailure(err)) throw new DuplicateError(duplicateMessage)
    throw err
  }
}

/** Sets the item's index attributes to `wanted` (removing ones it no longer has). */
async function reindex(TableName, item, wanted) {
  const names = {}
  const values = {}
  const sets = []
  const removes = []
  for (const a of INDEX_ATTRS) {
    if (wanted[a] !== undefined && wanted[a] !== item[a]) {
      names[`#${a}`] = a
      values[`:${a}`] = wanted[a]
      sets.push(`#${a} = :${a}`)
    } else if (wanted[a] === undefined && item[a] !== undefined) {
      names[`#${a}`] = a
      removes.push(`#${a}`)
    }
  }
  if (!sets.length && !removes.length) return item
  const expression = [sets.length ? `SET ${sets.join(', ')}` : '', removes.length ? `REMOVE ${removes.join(', ')}` : ''].join(' ').trim()
  const res = await send(
    new UpdateCommand({
      TableName,
      Key: { pk: item.pk, sk: item.sk },
      UpdateExpression: expression,
      ExpressionAttributeNames: names,
      ...(sets.length ? { ExpressionAttributeValues: values } : {}),
      ReturnValues: 'ALL_NEW',
    }),
  )
  return res.Attributes
}

/**
 * Updates an existing item: each field is set, or removed when null. Throws
 * ConditionalCheckFailedException when the item is missing or `condition` fails.
 * `keysOf(item)` re-derives the index attributes from the updated item.
 */
async function updateItem(TableName, key, fields, { keysOf, condition, names: conditionNames = {}, values: conditionValues = {} } = {}) {
  const names = { '#pk': 'pk', ...conditionNames }
  const values = { ...conditionValues }
  const sets = []
  const removes = []
  Object.entries(fields).forEach(([k, v], i) => {
    if (v === undefined) return
    names[`#f${i}`] = k
    if (v === null) removes.push(`#f${i}`)
    else {
      values[`:f${i}`] = v
      sets.push(`#f${i} = :f${i}`)
    }
  })
  const exists = `attribute_exists(#pk)${condition ? ` AND (${condition})` : ''}`
  let item
  if (!sets.length && !removes.length) {
    item = await getItem(TableName, key.pk, key.sk)
    if (!item) throw conditionFailed()
  } else {
    const expression = [sets.length ? `SET ${sets.join(', ')}` : '', removes.length ? `REMOVE ${removes.join(', ')}` : ''].join(' ').trim()
    item = (
      await send(
        new UpdateCommand({
          TableName,
          Key: key,
          UpdateExpression: expression,
          ConditionExpression: exists,
          ExpressionAttributeNames: names,
          ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
          ReturnValues: 'ALL_NEW',
        }),
      )
    ).Attributes
  }
  return keysOf ? reindex(TableName, item, keysOf(item)) : item
}

async function batchGet(TableName, keys) {
  const out = []
  for (let i = 0; i < keys.length; i += 100) {
    let request = { [TableName]: { Keys: keys.slice(i, i + 100), ConsistentRead: true } }
    while (request && Object.keys(request).length) {
      const res = await send(new BatchGetCommand({ RequestItems: request }))
      out.push(...(res.Responses?.[TableName] ?? []))
      request = res.UnprocessedKeys
    }
  }
  return out
}

// ---- Uniqueness guards --------------------------------------------------------------
// "One account per email", "one class per name" and "one submission per (assignment,
// student)" are guard items written first, with a conditional put, before the record
// itself. A guard whose record never appeared (a crash between the two writes) is
// reclaimed once it is a minute old.

const GUARD_STALE_MS = 60_000

async function claimGuard(TableName, key, id, recordExists, duplicateMessage) {
  const item = { ...key, ref: id, claimed_at: Date.now() }
  try {
    await send(
      new PutCommand({
        TableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) OR #ref = :ref',
        ExpressionAttributeNames: { '#ref': 'ref' },
        ExpressionAttributeValues: { ':ref': id },
      }),
    )
    return
  } catch (err) {
    if (!isConditionFailure(err)) throw err
  }
  const current = await getItem(TableName, key.pk, key.sk)
  if (current && Date.now() - Number(current.claimed_at ?? 0) > GUARD_STALE_MS && !(await recordExists(current.ref))) {
    try {
      await send(
        new PutCommand({
          TableName,
          Item: item,
          ConditionExpression: '#ref = :old',
          ExpressionAttributeNames: { '#ref': 'ref' },
          ExpressionAttributeValues: { ':old': current.ref },
        }),
      )
      return
    } catch (err) {
      if (!isConditionFailure(err)) throw err
    }
  }
  throw new DuplicateError(duplicateMessage)
}

const releaseGuard = (TableName, key, id) =>
  send(
    new DeleteCommand({
      TableName,
      Key: key,
      ConditionExpression: '#ref = :ref',
      ExpressionAttributeNames: { '#ref': 'ref' },
      ExpressionAttributeValues: { ':ref': id },
    }),
  ).catch((err) => {
    if (!isConditionFailure(err)) throw err
  })

/** Guard, then record; the guard is released again if the record can't be written. */
async function createGuarded(TableName, guardKey, id, recordExists, item, duplicateMessage) {
  await claimGuard(TableName, guardKey, id, recordExists, duplicateMessage)
  try {
    await putNew(TableName, item, `${item.pk} already exists.`)
  } catch (err) {
    await releaseGuard(TableName, guardKey, id)
    throw err
  }
}

// ---- users ------------------------------------------------------------------------------

const emailGuard = (email) => ({ pk: `EMAIL#${lower(email)}`, sk: 'EMAIL' })
const userKeys = (u) => ({
  pk: `USER#${u.user_id}`,
  sk: 'PROFILE',
  gsi1pk: `ROLE#${u.role}`,
  gsi1sk: `NAME#${lower(u.name)}#${u.user_id}`,
})
const userItem = async (id) => getItem(T().users, `USER#${id}`, 'PROFILE')

const users = {
  get: async (userId) => strip(await userItem(userId)),
  async getMany(ids) {
    const unique = [...new Set(ids.filter(Boolean))]
    const items = await batchGet(
      T().users,
      unique.map((id) => ({ pk: `USER#${id}`, sk: 'PROFILE' })),
    )
    return items.map((i) => strip(i))
  },
  async getByEmail(email) {
    if (!email) return undefined
    const guard = await getItem(T().users, emailGuard(email).pk, 'EMAIL')
    if (!guard) return undefined
    const user = strip(await userItem(guard.ref))
    return user && lower(user.email) === lower(email) ? user : undefined
  },
  async create(user) {
    assertColumns('users', user)
    await createGuarded(
      T().users,
      emailGuard(user.email),
      user.user_id,
      async (id) => Boolean(await userItem(id)),
      { ...userKeys(user), ...user },
      'An account with that email already exists.',
    )
    return compact(user)
  },
  async update(userId, fields) {
    assertColumns('users', fields)
    const key = { pk: `USER#${userId}`, sk: 'PROFILE' }
    const { email, ...rest } = fields
    if (email !== undefined && email !== null) {
      const current = await userItem(userId)
      if (!current) throw conditionFailed()
      if (lower(current.email) !== lower(email)) {
        const exists = async (id) => Boolean(await userItem(id))
        await claimGuard(T().users, emailGuard(email), userId, exists, 'An account with that email already exists.')
        try {
          await updateItem(T().users, key, { email })
        } catch (err) {
          await releaseGuard(T().users, emailGuard(email), userId)
          throw err
        }
        await releaseGuard(T().users, emailGuard(current.email), userId)
      } else if (current.email !== email) {
        await updateItem(T().users, key, { email })
      }
    }
    return strip(await updateItem(T().users, key, rest, { keysOf: userKeys }))
  },
  async list({ role } = {}) {
    const roles = role ? [role] : ROLES
    const pages = await Promise.all(roles.map((r) => query(T().users, { index: 'gsi1', pk: `ROLE#${r}` })))
    return pages.flat().map((i) => strip(i))
  },
}

// ---- classes and memberships ---------------------------------------------------------

const classNameGuard = (name) => ({ pk: `CLASSNAME#${lower(name)}`, sk: 'NAME' })
const classKeys = (c) => ({
  pk: `CLASS#${c.class_id}`,
  sk: 'METADATA',
  ...(c.teacher_id ? { gsi1pk: `TEACHER#${c.teacher_id}`, gsi1sk: `CLASS#${c.class_id}` } : {}),
})
const memberKeys = (m) => ({
  pk: `CLASS#${m.class_id}`,
  sk: `MEMBER#${m.student_id}`,
  gsi1pk: `USER#${m.student_id}`,
  gsi1sk: `CLASS#${m.class_id}`,
})
const classItem = (id) => getItem(T().classes, `CLASS#${id}`, 'METADATA')

const classes = {
  get: async (classId) => strip(await classItem(classId)),
  async getMany(ids) {
    const unique = [...new Set(ids.filter(Boolean))]
    return (
      await batchGet(
        T().classes,
        unique.map((id) => ({ pk: `CLASS#${id}`, sk: 'METADATA' })),
      )
    ).map((i) => strip(i))
  },
  async getByName(name) {
    const guard = await getItem(T().classes, classNameGuard(name).pk, 'NAME')
    return guard ? strip(await classItem(guard.ref)) : undefined
  },
  async create(cls) {
    assertColumns('classes', cls)
    await createGuarded(
      T().classes,
      classNameGuard(cls.name),
      cls.class_id,
      async (id) => Boolean(await classItem(id)),
      { ...classKeys(cls), ...cls },
      `A class named ${cls.name} already exists.`,
    )
    return compact(cls)
  },
  async update(classId, fields) {
    assertColumns('classes', fields)
    return strip(await updateItem(T().classes, { pk: `CLASS#${classId}`, sk: 'METADATA' }, fields, { keysOf: classKeys }))
  },
  listByTeacher: async (teacherId) =>
    (await query(T().classes, { index: 'gsi1', pk: `TEACHER#${teacherId}`, prefix: 'CLASS#' })).map((i) => strip(i)),
  members: async (classId) => (await query(T().classes, { pk: `CLASS#${classId}`, prefix: 'MEMBER#' })).map((i) => strip(i)),
  memberships: async (studentId) =>
    (await query(T().classes, { index: 'gsi1', pk: `USER#${studentId}`, prefix: 'CLASS#' })).map((i) => strip(i)),
  /** Enrols (or re-enrols) a student; keeps the original added_by/added_at. */
  async addMember({ class_id: classId, student_id: studentId, added_by: addedBy, added_at: addedAt }) {
    const keys = memberKeys({ class_id: classId, student_id: studentId })
    const res = await send(
      new UpdateCommand({
        TableName: T().classes,
        Key: { pk: keys.pk, sk: keys.sk },
        UpdateExpression:
          'SET class_id = :c, student_id = :s, member_status = :e, gsi1pk = :g1, gsi1sk = :g2, ' +
          'added_by = if_not_exists(added_by, :by), added_at = if_not_exists(added_at, :at)',
        ExpressionAttributeValues: {
          ':c': classId,
          ':s': studentId,
          ':e': 'enrolled',
          ':g1': keys.gsi1pk,
          ':g2': keys.gsi1sk,
          ':by': addedBy ?? null,
          ':at': addedAt,
        },
        ReturnValues: 'ALL_NEW',
      }),
    )
    return strip(res.Attributes)
  },
  setMemberStatus: async (classId, studentId, status) =>
    strip(await updateItem(T().classes, { pk: `CLASS#${classId}`, sk: `MEMBER#${studentId}` }, { member_status: status })),
}

// ---- assignments, question papers, questions -------------------------------------------

const assignmentKeys = (a) => ({
  pk: `ASSIGN#${a.assignment_id}`,
  sk: 'METADATA',
  ...(a.class_id ? { gsi1pk: `CLASS#${a.class_id}`, gsi1sk: `DUE#${a.due_at ?? '~'}#${a.assignment_id}` } : {}),
  ...(a.teacher_id ? { gsi2pk: `TEACHER#${a.teacher_id}`, gsi2sk: `CREATED#${a.created_at}#${a.assignment_id}` } : {}),
})

const assignments = {
  get: async (assignmentId) => strip(await getItem(T().assignments, `ASSIGN#${assignmentId}`, 'METADATA')),
  async getMany(ids) {
    const unique = [...new Set(ids.filter(Boolean))]
    const keys = unique.map((id) => ({ pk: `ASSIGN#${id}`, sk: 'METADATA' }))
    return (await batchGet(T().assignments, keys)).map((i) => strip(i))
  },
  async create(a) {
    assertColumns('assignments', a)
    await putNew(T().assignments, { ...assignmentKeys(a), ...a }, `Assignment ${a.assignment_id} already exists.`)
    return compact(a)
  },
  async update(assignmentId, fields) {
    assertColumns('assignments', fields)
    return strip(await updateItem(T().assignments, { pk: `ASSIGN#${assignmentId}`, sk: 'METADATA' }, fields, { keysOf: assignmentKeys }))
  },
  listByTeacher: async (teacherId) =>
    (await query(T().assignments, { index: 'gsi2', pk: `TEACHER#${teacherId}`, prefix: 'CREATED#' })).map((i) => strip(i)),
  listByClass: async (classId) =>
    (await query(T().assignments, { index: 'gsi1', pk: `CLASS#${classId}`, prefix: 'DUE#' })).map((i) => strip(i)),
  /** Admin only: every assignment (a scan). */
  listAll: async () =>
    (
      await scanAll({
        TableName: T().assignments,
        FilterExpression: 'sk = :m',
        ExpressionAttributeValues: { ':m': 'METADATA' },
      })
    ).map((i) => strip(i)),
}

const questionKey = (qpId, questionNumber, subpart) => ({ pk: `QP#${qpId}`, sk: `Q#${qKey(questionNumber)}#${spKey(subpart)}` })

const papers = {
  get: async (qpId) => strip(await getItem(T().questionPapers, `QP#${qpId}`, 'METADATA')),
  async create(p) {
    assertColumns('question_papers', p)
    await putNew(T().questionPapers, { pk: `QP#${p.qp_id}`, sk: 'METADATA', ...p }, `Question paper ${p.qp_id} already exists.`)
    return compact(p)
  },
  /** `ifStatus`: only update while the paper is in that status (else ConditionalCheckFailedException). */
  async update(qpId, fields, { ifStatus } = {}) {
    assertColumns('question_papers', fields)
    return strip(
      await updateItem(
        T().questionPapers,
        { pk: `QP#${qpId}`, sk: 'METADATA' },
        fields,
        ifStatus ? { condition: '#st = :expected', names: { '#st': 'status' }, values: { ':expected': ifStatus } } : {},
      ),
    )
  },
  questions: async (qpId) => (await query(T().questionPapers, { pk: `QP#${qpId}`, prefix: 'Q#' })).map((i) => strip(i)),
  /** Adds the question, or replaces the stored copy of it. */
  async putQuestion(q) {
    assertColumns('questions', q)
    await send(new PutCommand({ TableName: T().questionPapers, Item: { ...questionKey(q.qp_id, q.question_number, q.subpart), ...q } }))
    return compact(q)
  },
  /** Updates one question; `subpart` undefined = every subpart of that number. Returns the updated questions. */
  async updateQuestions(qpId, questionNumber, subpart, fields) {
    assertColumns('questions', fields)
    const all = await query(T().questionPapers, { pk: `QP#${qpId}`, prefix: `Q#${qKey(questionNumber)}#` })
    const targets = all.filter((q) => subpart === undefined || spKey(q.subpart) === spKey(subpart))
    const out = []
    for (const q of targets) out.push(strip(await updateItem(T().questionPapers, { pk: q.pk, sk: q.sk }, fields)))
    return out
  },
}

// ---- submissions and answers ----------------------------------------------------------

const submissionGuard = (assignmentId, studentId) => ({ pk: `ASSIGN#${assignmentId}#USER#${studentId}`, sk: 'SUBMISSION' })
const submissionKeys = (s) => ({
  pk: `SUB#${s.submission_id}`,
  sk: 'METADATA',
  gsi1pk: `ASSIGN#${s.assignment_id}`,
  gsi1sk: `USER#${s.student_id}#METADATA`,
  gsi2pk: `USER#${s.student_id}`,
  gsi2sk: `CREATED#${s.created_at}#${s.submission_id}`,
})
// Answer items also carry assignment_id/student_id (for GSI1); records don't show them.
const ANSWER_HIDDEN = ['assignment_id', 'student_id']
const answerSk = (a) => `ANSWER#${qKey(a.question_number)}#${spKey(a.subpart)}`
const answerKeys = (a, sub) => ({
  pk: `SUB#${sub.submission_id}`,
  sk: answerSk(a),
  gsi1pk: `ASSIGN#${sub.assignment_id}`,
  gsi1sk: `USER#${sub.student_id}#${answerSk(a)}`,
  gsi3pk: `ANSWER#${a.answer_id}`,
  gsi3sk: 'ANSWER',
})
const submissionItem = (id) => getItem(T().submissions, `SUB#${id}`, 'METADATA')

async function answerItem(answerId) {
  const [item] = await query(T().submissions, { index: 'gsi3', pk: `ANSWER#${answerId}` })
  return item
}

const submissions = {
  get: async (submissionId) => strip(await submissionItem(submissionId)),
  async getFor(assignmentId, studentId) {
    const guard = await getItem(T().submissions, submissionGuard(assignmentId, studentId).pk, 'SUBMISSION')
    return guard ? strip(await submissionItem(guard.ref)) : undefined
  },
  async create(s) {
    assertColumns('submissions', s)
    await createGuarded(
      T().submissions,
      submissionGuard(s.assignment_id, s.student_id),
      s.submission_id,
      async (id) => Boolean(await submissionItem(id)),
      { ...submissionKeys(s), ...s },
      'This student already has a submission for this assignment.',
    )
    return compact(s)
  },
  async update(submissionId, fields) {
    assertColumns('submissions', fields)
    return strip(await updateItem(T().submissions, { pk: `SUB#${submissionId}`, sk: 'METADATA' }, fields))
  },
  listByStudent: async (studentId) =>
    (await query(T().submissions, { index: 'gsi2', pk: `USER#${studentId}`, prefix: 'CREATED#' })).map((i) => strip(i)),
  /** Every submission of an assignment with its answers — the grading grid, one query. */
  async grid(assignmentId) {
    const items = await query(T().submissions, { index: 'gsi1', pk: `ASSIGN#${assignmentId}` })
    return {
      submissions: items.filter((i) => i.sk === 'METADATA').map((i) => strip(i)),
      answers: items.filter((i) => i.sk.startsWith('ANSWER#')).map((i) => strip(i, ANSWER_HIDDEN)),
    }
  },
  answers: async (submissionId) =>
    (await query(T().submissions, { pk: `SUB#${submissionId}`, prefix: 'ANSWER#' })).map((i) => strip(i, ANSWER_HIDDEN)),
  getAnswer: async (answerId) => strip(await answerItem(answerId), ANSWER_HIDDEN),
  /** Adds the answer to its submission, or replaces the stored answer to that question. */
  async putAnswer(answer) {
    assertColumns('answers', answer)
    const sub = await submissionItem(answer.submission_id)
    if (!sub) throw conditionFailed(`No submission ${answer.submission_id}`)
    const item = { ...answerKeys(answer, sub), assignment_id: sub.assignment_id, student_id: sub.student_id, ...answer }
    await send(new PutCommand({ TableName: T().submissions, Item: item }))
    return compact(answer)
  },
  /** Updates an answer; `questionNumber` (if given) must match the stored one. */
  async updateAnswer(answerId, fields, { questionNumber } = {}) {
    assertColumns('answers', fields)
    const item = await answerItem(answerId)
    if (!item) throw conditionFailed()
    if (questionNumber !== undefined && qKey(item.question_number) !== qKey(questionNumber)) throw conditionFailed()
    const updated = await updateItem(T().submissions, { pk: item.pk, sk: item.sk }, fields, {
      condition: '#aid = :aid',
      names: { '#aid': 'answer_id' },
      values: { ':aid': answerId },
    })
    return strip(updated, ANSWER_HIDDEN)
  },
}

// ---- password resets, invites, audit log ----------------------------------------------

const resetKeys = (r) => ({
  pk: `RESET#${r.request_id}`,
  sk: 'METADATA',
  gsi1pk: `STATUS#${r.status}`,
  gsi1sk: `${sortableEpoch(r.requested_at)}#${r.request_id}`,
})

const resets = {
  get: async (requestId) => strip(await getItem(T().resetRequests, `RESET#${requestId}`, 'METADATA')),
  async create(r) {
    assertColumns('reset_requests', r)
    await putNew(T().resetRequests, { ...resetKeys(r), ...r }, `Reset request ${r.request_id} already exists.`)
    return compact(r)
  },
  async update(requestId, fields) {
    assertColumns('reset_requests', fields)
    return strip(await updateItem(T().resetRequests, { pk: `RESET#${requestId}`, sk: 'METADATA' }, fields, { keysOf: resetKeys }))
  },
  /** Newest first. */
  listByStatus: async (status) =>
    (await query(T().resetRequests, { index: 'gsi1', pk: `STATUS#${status}`, forward: false })).map((i) => strip(i)),
  async openForUser(userId) {
    const open = await Promise.all(['pending', 'approved'].map((s) => resets.listByStatus(s)))
    return open.flat().filter((r) => r.user_id === userId)
  },
}

const appItem = async (pk) => getItem(T().app, pk, 'METADATA')

const invites = {
  get: async (token) => strip(await appItem(`INVITE#${token}`)),
  async create(i) {
    assertColumns('invites', i)
    await putNew(T().app, { pk: `INVITE#${i.token}`, sk: 'METADATA', ...i }, 'Invite token already exists.')
    return compact(i)
  },
  async update(token, fields) {
    assertColumns('invites', fields)
    return strip(await updateItem(T().app, { pk: `INVITE#${token}`, sk: 'METADATA' }, fields))
  },
}

const audit = {
  async append(e) {
    assertColumns('audit_log', e)
    await send(
      new PutCommand({ TableName: T().auditLog, Item: { pk: `AUDIT#${e.month}`, sk: `${sortableEpoch(e.ts)}#${e.event_id}`, ...e } }),
    )
  },
  /** Newest first, reading month partitions back from now (at most `months` of them). */
  async recent({ limit = 200, months = 24 } = {}) {
    const out = []
    const cursor = new Date()
    cursor.setUTCDate(1)
    for (let i = 0; i < months && out.length < limit; i++) {
      const month = cursor.toISOString().slice(0, 7)
      out.push(...(await query(T().auditLog, { pk: `AUDIT#${month}`, forward: false })))
      cursor.setUTCMonth(cursor.getUTCMonth() - 1)
    }
    return out.slice(0, limit).map((i) => strip(i))
  },
}

// ---- announcements ---------------------------------------------------------------------

const announcementKeys = (a) => ({
  pk: `ANN#${a.announcement_id}`,
  sk: 'METADATA',
  gsi1pk: `CLASSNAME#${lower(a.class_name)}`,
  gsi1sk: `CREATED#${a.created_at}#${a.announcement_id}`,
  ...(a.author_id ? { gsi2pk: `AUTHOR#${a.author_id}`, gsi2sk: `CREATED#${a.created_at}#${a.announcement_id}` } : {}),
})

const announcements = {
  get: async (id) => strip(await getItem(T().announcements, `ANN#${id}`, 'METADATA')),
  async create(a) {
    assertColumns('announcements', a)
    await putNew(T().announcements, { ...announcementKeys(a), ...a }, `Announcement ${a.announcement_id} already exists.`)
    return compact(a)
  },
  delete: (id) => send(new DeleteCommand({ TableName: T().announcements, Key: { pk: `ANN#${id}`, sk: 'METADATA' } })),
  async listByClassNames(names) {
    const unique = [...new Set(names.map(lower))]
    const pages = await Promise.all(unique.map((n) => query(T().announcements, { index: 'gsi1', pk: `CLASSNAME#${n}`, forward: false })))
    return pages.flat().map((i) => strip(i))
  },
  listByAuthor: async (authorId) =>
    (await query(T().announcements, { index: 'gsi2', pk: `AUTHOR#${authorId}`, forward: false })).map((i) => strip(i)),
  /** Admin only (a scan). */
  listAll: async () => (await scanAll({ TableName: T().announcements })).map((i) => strip(i)),
}

// ---- admin console: content posts, tickets, settings, analytics -------------------------

const postKeys = (p) => ({
  pk: `POST#${p.post_id}`,
  sk: 'METADATA',
  gsi1pk: 'POSTS',
  gsi1sk: `${p.status}#${p.date_label ?? ''}#${p.post_id}`,
})
const ticketKeys = (t) => ({ pk: `TICKET#${t.ticket_id}`, sk: 'METADATA', gsi1pk: 'TICKETS', gsi1sk: `${t.status}#${t.ticket_id}` })

const posts = {
  async create(p) {
    assertColumns('content_posts', p)
    await putNew(T().app, { ...postKeys(p), ...p }, `Post ${p.post_id} already exists.`)
    return compact(p)
  },
  list: async ({ status } = {}) =>
    (await query(T().app, { index: 'gsi1', pk: 'POSTS', ...(status ? { prefix: `${status}#` } : {}) })).map((i) => strip(i)),
  async update(postId, fields) {
    assertColumns('content_posts', fields)
    return strip(await updateItem(T().app, { pk: `POST#${postId}`, sk: 'METADATA' }, fields, { keysOf: postKeys }))
  },
}

const tickets = {
  async create(t) {
    assertColumns('tickets', t)
    await putNew(T().app, { ...ticketKeys(t), ...t }, `Ticket ${t.ticket_id} already exists.`)
    return compact(t)
  },
  async list({ status, assigneeId } = {}) {
    const items = (await query(T().app, { index: 'gsi1', pk: 'TICKETS', ...(status ? { prefix: `${status}#` } : {}) })).map((i) => strip(i))
    return assigneeId ? items.filter((t) => t.assignee_id === assigneeId) : items
  },
  async update(ticketId, fields) {
    assertColumns('tickets', fields)
    return strip(await updateItem(T().app, { pk: `TICKET#${ticketId}`, sk: 'METADATA' }, fields, { keysOf: ticketKeys }))
  },
}

const settings = {
  get: async (key) => strip(await appItem(`SETTING#${key}`)),
  async put(key, data) {
    await send(new PutCommand({ TableName: T().app, Item: { pk: `SETTING#${key}`, sk: 'METADATA', setting_key: key, data } }))
  },
}

const metrics = {
  get: async (key) => strip(await appItem(`METRIC#${key}`)),
  async put(key, dataJson) {
    await send(new PutCommand({ TableName: T().app, Item: { pk: `METRIC#${key}`, sk: 'METADATA', metric_key: key, data_json: dataJson } }))
  },
}

export default {
  name: 'dynamodb',
  init: connectDynamo,
  close: closeDynamo,
  /** Cheap connectivity probe for /health/ready. */
  async ping() {
    await getItem(T().users, 'EMAIL#__healthcheck__', 'EMAIL')
  },
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
