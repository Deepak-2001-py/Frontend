// Contract tests for the data store: the same scenarios against whichever
// implementation TEST_DB_DRIVER selects (memory = the DynamoDB tables in the
// emulator; postgres = the Supabase schema), so the two stay interchangeable.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, test } from 'node:test'
import { config, dbDriver, importTables, repositories as db, startServer, stopServer } from './helpers.js'

const { verifyPassword, hashAdminPassword, hashLoginPassword } = await import('../src/lib/passwords.js')
const gradebook = await import('../src/repositories/gradebook.js')

const at = '2026-10-01T09:00:00+00:00'
const rejects = (promise, name) => assert.rejects(promise, (err) => err.name === name)

describe(`data store contract (${dbDriver})`, () => {
  before(() => startServer())
  after(stopServer)

  test('users: unique email (case-insensitive), lookups, updates, role listing', async () => {
    await db.users.create({ user_id: 'U1', email: 'Ada@x.edu', name: 'Ada', role: 'teacher', account_status: 'active', created_at: at })
    await db.users.create({ user_id: 'U2', email: 'bo@x.edu', name: 'bo', role: 'student', account_status: 'active', created_at: at })
    await rejects(
      db.users.create({ user_id: 'U3', email: 'ada@X.edu', name: 'x', role: 'student', account_status: 'active', created_at: at }),
      'DuplicateError',
    )
    assert.equal((await db.users.getByEmail('ADA@x.edu')).user_id, 'U1')
    assert.equal(await db.users.getByEmail('nobody@x.edu'), undefined)
    assert.equal(await db.users.get('U3'), undefined)

    // Email changes move the uniqueness with them.
    await rejects(db.users.update('U2', { email: 'ada@x.edu' }), 'DuplicateError')
    await db.users.update('U2', { email: 'bo2@x.edu', name: 'Bo', phone: '123' })
    assert.equal(await db.users.getByEmail('bo@x.edu'), undefined)
    assert.equal((await db.users.getByEmail('bo2@x.edu')).name, 'Bo')
    await db.users.create({ user_id: 'U4', email: 'bo@x.edu', name: 'New Bo', role: 'student', account_status: 'invited', created_at: at })

    // null clears a field; unknown fields and missing records are refused.
    const cleared = await db.users.update('U2', { phone: null, settings: { default_persona: 'strict' } })
    assert.equal(cleared.phone, undefined)
    assert.deepEqual(cleared.settings, { default_persona: 'strict' })
    await rejects(db.users.update('nope', { name: 'x' }), 'ConditionalCheckFailedException')
    await assert.rejects(db.users.update('U2', { userRole: 'admin' }), /Unknown users field/)

    const students = await db.users.list({ role: 'student' })
    assert.deepEqual(students.map((u) => u.user_id).sort(), ['U2', 'U4'])
    // Changing the role moves the user between role listings.
    await db.users.update('U4', { role: 'teacher' })
    assert.deepEqual((await db.users.list({ role: 'teacher' })).map((u) => u.user_id).sort(), ['U1', 'U4'])
    assert.deepEqual((await db.users.getMany(['U1', 'U2', 'missing'])).map((u) => u.user_id).sort(), ['U1', 'U2'])
  })

  test('classes: unique name, enrolment both ways, re-enrolment', async () => {
    await db.classes.create({ class_id: 'C1', name: 'PHY-204', teacher_id: 'U1', created_at: at })
    await rejects(db.classes.create({ class_id: 'C2', name: 'phy-204', created_at: at }), 'DuplicateError')
    assert.equal((await db.classes.getByName('Phy-204')).class_id, 'C1')
    assert.deepEqual(
      (await db.classes.listByTeacher('U1')).map((c) => c.class_id),
      ['C1'],
    )

    await db.classes.addMember({ class_id: 'C1', student_id: 'U2', added_by: 'U1', added_at: at })
    assert.deepEqual(
      (await db.classes.memberships('U2')).map((m) => [m.class_id, m.member_status]),
      [['C1', 'enrolled']],
    )
    await db.classes.setMemberStatus('C1', 'U2', 'removed')
    const again = await db.classes.addMember({ class_id: 'C1', student_id: 'U2', added_by: 'other', added_at: '2030-01-01' })
    assert.equal(again.member_status, 'enrolled')
    assert.equal(again.added_by, 'U1') // the original enrolment is kept
    assert.deepEqual(
      (await db.classes.members('C1')).map((m) => m.student_id),
      ['U2'],
    )
  })

  test('assignments + question papers: owner and class feeds, conditional paper updates, questions', async () => {
    await gradebook.createAssignment({
      assignment_id: 'A1',
      qp_id: 'QP1',
      title: 'HW',
      class_id: 'C1',
      class_name: 'PHY-204',
      teacher_id: 'U1',
      due_at: '2030-01-02',
      content_status: 'published',
      grades_status: 'not_started',
      created_at: at,
      qp_status: 'qp_uploaded',
    })
    assert.deepEqual(
      (await db.assignments.listByTeacher('U1')).map((a) => a.assignment_id),
      ['A1'],
    )
    assert.deepEqual(
      (await db.assignments.listByClass('C1')).map((a) => a.assignment_id),
      ['A1'],
    )
    const record = await gradebook.getAssignment('A1')
    assert.equal(record.qp_status, 'qp_uploaded')

    // Moving the assignment to another teacher moves it between feeds.
    await db.assignments.update('A1', { teacher_id: 'U4' })
    assert.deepEqual(await db.assignments.listByTeacher('U1'), [])
    await db.assignments.update('A1', { teacher_id: 'U1' })

    await rejects(
      gradebook.updateAssignment(record, { qp_status: 'rubric_generated' }, { ifQpStatus: 'rubric_generating' }),
      'ConditionalCheckFailedException',
    )
    await gradebook.updateAssignment(record, { qp_status: 'rubric_generating', method: 'ai' })
    await gradebook.updateAssignment(
      record,
      { qp_status: 'rubric_generated', rubric: [{ question_number: 1, max_marks: 5 }] },
      { ifQpStatus: 'rubric_generating' },
    )
    const updated = await gradebook.getAssignment('A1')
    assert.equal(updated.qp_status, 'rubric_generated')
    assert.equal(updated.method, 'ai')
    assert.deepEqual(updated.rubric, [{ question_number: 1, max_marks: 5 }])
    await gradebook.updateAssignment(updated, { rubric: null })
    assert.equal((await gradebook.getAssignment('A1')).rubric, undefined)

    await db.papers.putQuestion({ qp_id: 'QP1', question_number: 1, question: 'Q one', max_marks: 5 })
    await db.papers.putQuestion({ qp_id: 'QP1', question_number: 2, subpart: 'a', question: 'Q 2a', max_marks: 2 })
    await db.papers.putQuestion({ qp_id: 'QP1', question_number: 2, subpart: 'b', question: 'Q 2b', max_marks: 3 })
    await db.papers.putQuestion({ qp_id: 'QP1', question_number: '1', question: 'Q one (fixed)', max_marks: 5 }) // "1" is question 1
    const qs = await db.papers.questions('QP1')
    assert.equal(qs.length, 3)
    assert.equal(qs.find((q) => String(q.question_number) === '1').question, 'Q one (fixed)')
    assert.equal((await db.papers.updateQuestions('QP1', 2, undefined, { reviewed_by: 'U1' })).length, 2)
    assert.equal((await db.papers.updateQuestions('QP1', 2, 'b', { question: 'Q 2b!' })).length, 1)
    assert.deepEqual(await db.papers.updateQuestions('QP1', 9, undefined, { question: 'x' }), [])
  })

  test('submissions + answers: one per student, the grading grid, answers by id', async () => {
    const a = await gradebook.getAssignment('A1')
    const sub = await gradebook.ensureSubmission(a, 'U2')
    assert.equal((await gradebook.ensureSubmission(a, 'U2')).submission_id, sub.submission_id)
    await rejects(
      db.submissions.create({ submission_id: 'other', assignment_id: 'A1', qp_id: 'QP1', student_id: 'U2', created_at: at }),
      'DuplicateError',
    )
    await db.submissions.putAnswer({
      answer_id: 'E1',
      submission_id: sub.submission_id,
      question_number: 1,
      student_answer: 'x',
      max_marks: 5,
      created_at: at,
    })
    await db.submissions.putAnswer({
      answer_id: 'E2',
      submission_id: sub.submission_id,
      question_number: 2,
      subpart: 'a',
      max_marks: 2,
      created_at: at,
    })
    await rejects(
      db.submissions.putAnswer({ answer_id: 'E9', submission_id: 'missing', question_number: 1 }),
      'ConditionalCheckFailedException',
    )

    // A wrong question number is refused, like the old ConditionExpression.
    await rejects(db.submissions.updateAnswer('E1', { marks: 4 }, { questionNumber: 2 }), 'ConditionalCheckFailedException')
    await rejects(db.submissions.updateAnswer('nope', { marks: 4 }), 'ConditionalCheckFailedException')
    assert.equal((await db.submissions.updateAnswer('E1', { marks: 4 }, { questionNumber: '1' })).marks, 4)
    await db.submissions.update(sub.submission_id, { total_marks: 4, graded_at: at, status: 'ai_graded' })

    const grid = await db.submissions.grid('A1')
    assert.deepEqual(
      grid.submissions.map((s) => s.student_id),
      ['U2'],
    )
    assert.deepEqual(grid.answers.map((x) => x.answer_id).sort(), ['E1', 'E2'])
    assert.equal((await db.submissions.getAnswer('E2')).submission_id, sub.submission_id)
    assert.deepEqual(
      (await db.submissions.listByStudent('U2')).map((s) => s.assignment_id),
      ['A1'],
    )

    // The rows the grading APIs return.
    const { byStudent } = await gradebook.gradingGrid(a)
    const entry = byStudent.get('U2')
    assert.equal(entry.summary.evaluation_id, sub.submission_id)
    assert.equal(entry.summary.total_marks, 4)
    assert.equal(entry.summary.teacher_id, 'U1')
    const q1 = entry.details.find((d) => d.evaluation_id === 'E1')
    assert.equal(q1.question, 'Q one (fixed)')
    assert.equal(q1.type, 'detail')
    assert.equal(q1.marks, 4)
    assert.equal(q1.timestamp, Date.parse(at) / 1000)
  })

  test('reset requests, invites, audit log, announcements, console records', async () => {
    await db.resets.create({ request_id: 'R1', user_id: 'U2', status: 'pending', requested_at: 100, source: 'login' })
    await db.resets.create({ request_id: 'R2', user_id: 'U4', status: 'pending', requested_at: 200, source: 'login' })
    assert.deepEqual(
      (await db.resets.listByStatus('pending')).map((r) => r.request_id),
      ['R2', 'R1'],
    )
    await db.resets.update('R1', { status: 'approved' })
    assert.deepEqual(
      (await db.resets.listByStatus('pending')).map((r) => r.request_id),
      ['R2'],
    )
    assert.deepEqual(
      (await db.resets.openForUser('U2')).map((r) => r.request_id),
      ['R1'],
    )
    await db.resets.update('R1', { status: 'rejected' })
    assert.deepEqual(await db.resets.openForUser('U2'), [])

    await db.invites.create({ token: 'tok', user_id: 'U4', role: 'student', expires_at: 10, consumed: false })
    assert.equal((await db.invites.update('tok', { consumed: true })).consumed, true)

    const now = Date.now() / 1000
    for (const [i, ts] of [now - 60, now - 30, now - 10].entries()) {
      await db.audit.append({ event_id: `E${i}`, month: new Date(ts * 1000).toISOString().slice(0, 7), ts, action: `a${i}` })
    }
    assert.deepEqual(
      (await db.audit.recent({ limit: 2 })).map((e) => e.action),
      ['a2', 'a1'],
    )

    for (const [id, cls, created] of [
      ['N1', 'PHY-204', at],
      ['N2', 'phy-204', '2026-10-02'],
      ['N3', 'BIO', at],
    ]) {
      await db.announcements.create({
        announcement_id: id,
        class_name: cls,
        title: 't',
        message: 'm',
        author_id: 'U1',
        created_at: created,
      })
    }
    assert.deepEqual((await db.announcements.listByClassNames(['Phy-204'])).map((n) => n.announcement_id).sort(), ['N1', 'N2'])
    assert.equal((await db.announcements.listByAuthor('U1')).length, 3)
    await db.announcements.delete('N3')
    assert.equal(await db.announcements.get('N3'), undefined)

    await db.posts.create({ post_id: 'P1', title: 'x', status: 'draft' })
    await db.posts.update('P1', { status: 'published' })
    assert.deepEqual(
      (await db.posts.list({ status: 'published' })).map((p) => p.post_id),
      ['P1'],
    )
    assert.deepEqual(await db.posts.list({ status: 'draft' }), [])
    await db.tickets.create({ ticket_id: 'K1', status: 'open' })
    await db.tickets.update('K1', { assignee_id: 'U1' })
    assert.equal((await db.tickets.list({ assigneeId: 'U1' })).length, 1)
    await db.settings.put('platform', { platform_name: 'X' })
    assert.deepEqual((await db.settings.get('platform')).data, { platform_name: 'X' })
    await db.metrics.put('7d', '{"a":1}')
    assert.equal((await db.metrics.get('7d')).data_json, '{"a":1}')
  })
})

describe(`migration from the old tables (${dbDriver})`, () => {
  const fixture = JSON.parse(readFileSync(new URL('../scripts/parity/fixture.json', import.meta.url), 'utf8'))
  let tables
  before(async () => {
    await startServer()
    const resolve = async (v) => {
      if (v && typeof v === 'object' && '$loginHash' in v) return hashLoginPassword(v.$loginHash)
      if (v && typeof v === 'object' && '$adminHash' in v) return hashAdminPassword(v.$adminHash)
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return Object.fromEntries(await Promise.all(Object.entries(v).map(async ([k, x]) => [k, await resolve(x)])))
      }
      return v
    }
    const byPhysical = Object.fromEntries(Object.entries(config.legacyTables).map(([logical, name]) => [name, logical]))
    tables = {}
    for (const [name, items] of Object.entries(fixture.tables)) tables[byPhysical[name]] = await Promise.all(items.map(resolve))
  })
  after(stopServer)

  test('maps every old table, and running it again changes nothing', async () => {
    const first = await importTables(tables)
    assert.deepEqual(first.warnings, [])
    assert.equal(first.counts.users, 10)
    assert.equal(first.counts.submissions, 3)
    assert.equal(first.counts.answers, 5)
    assert.equal(first.counts.questions, 3)

    const snapshot = async () => ({
      users: await db.users.list(),
      grid: await db.submissions.grid('A-thermo'),
      questions: await db.papers.questions('QP-thermo'),
      thermo: await gradebook.getAssignment('A-thermo'),
    })
    const before = await snapshot()
    const second = await importTables(tables)
    assert.deepEqual(second.warnings, [])
    assert.deepEqual(await snapshot(), before)
  })

  test('accounts are merged: one password; console-only accounts keep theirs', async () => {
    const admin = await db.users.getByEmail('admin@x.edu')
    assert.equal(admin.role, 'admin')
    assert.equal(admin.school, 'Lincoln HS')
    assert.ok(await verifyPassword(admin.password_hash, 'Password123!')) // the login password wins
    assert.equal((await db.users.getByEmail('b@x.edu')).school, 'Hill Academy') // console fields come along
    const invited = await db.users.get('A9')
    assert.equal(invited.account_status, 'invited')
  })

  test('classes, submissions and answers', async () => {
    const phy = await db.classes.getByName('PHY-204')
    assert.deepEqual((await db.classes.members(phy.class_id)).map((m) => m.student_id).sort(), ['S1', 'S2', 'S3'])
    const thermo = await gradebook.getAssignment('A-thermo')
    assert.equal(thermo.class_id, phy.class_id)
    assert.equal(thermo.qp_status, 'rubric_reviewed')
    const { byStudent } = await gradebook.gradingGrid(thermo)
    assert.equal(byStudent.get('S1').summary.evaluation_id, 'S1-sum')
    assert.equal(byStudent.get('S1').summary.timestamp, 1790000000)
    assert.deepEqual(
      byStudent.get('S2').details.map((d) => [d.evaluation_id, d.marks, d.question]),
      [
        ['S2-1', 3, 'Define internal energy.'],
        ['S2-2', 2, 'State the first law.'],
      ],
    )
    // S3 has OCR'd answers to the optics quiz but no score yet.
    const optics = await gradebook.getAssignment('A-optics')
    const s3 = (await gradebook.gradingGrid(optics)).byStudent.get('S3')
    assert.equal(s3.summary, null)
    assert.equal(s3.details[0].status, 'ocr_done')
  })
})
