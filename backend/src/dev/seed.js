// Demo data for local development (same as the Python local_dev_server.py):
// an admin, a teacher, three students in PHY-204 and one graded assignment,
// written in the data model of docs/database-architecture.md.
// Password for every demo account: Password123!
import config from '../config/index.js'
import { hashPassword } from '../lib/passwords.js'
import { isoUtc } from '../lib/py.js'
import { createAssignment } from '../repositories/gradebook.js'
import { announcements, assignments, classes, papers, submissions, users } from '../repositories/index.js'

export const DEMO_PASSWORD = 'Password123!'

// [user_id, email, name, role, enrolled in PHY-204]
const PEOPLE = [
  ['A1', 'admin@gradeant.dev', 'Alex Morgan', 'admin', false],
  ['T1', 'teacher@gradeant.dev', 'Dr. Priya Nair', 'teacher', false],
  ['S1', 'riya@gradeant.dev', 'Riya Sharma', 'student', true],
  ['S2', 'sam@gradeant.dev', 'Sam Okafor', 'student', true],
  ['S3', 'li@gradeant.dev', 'Li Wei', 'student', true],
]

const QUESTIONS = [
  [1, 'Define internal energy and state its SI unit.', 5],
  [2, 'State the first law of thermodynamics for a closed system.', 5],
  [3, 'Calculate the work done in an isothermal expansion of 1 mol of ideal gas from 1 L to 2 L at 300 K.', 10],
]

// student -> per-question [marks, answer, feedback, confidence]
const RESULTS = {
  S1: [
    [5, 'U is the total energy of the system; unit J.', 'Correct.', 0.97],
    [4, 'dU = Q - W', 'Right relation; state the sign convention.', 0.95],
    [9, 'W = nRT ln(V2/V1) = 1729 J', 'Good — units clear.', 0.93],
  ],
  S2: [
    [3, 'energy inside', 'Missing the SI unit.', 0.9],
    [5, 'ΔU = Q − W for a closed system', 'Correct.', 0.96],
    [4, 'W = 8.314*300*ln2 = 1.7 kJ (sign?)', 'Method right; sign of work unclear.', 0.61],
  ],
}

/** With AUTH_DRIVER=supabase the demo accounts need a login in Supabase Auth too. */
async function seedSupabaseUsers() {
  const { createUser } = await import('../lib/supabaseAuth.js')
  try {
    for (const [, email] of PEOPLE) await createUser(email, DEMO_PASSWORD, { update: true })
    console.log(JSON.stringify({ level: 'info', msg: 'demo users are ready in Supabase Auth' }))
  } catch (err) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'could not create the demo users in Supabase Auth', detail: err?.message }))
  }
}

export async function seedDemoData() {
  if (config.auth.driver === 'supabase') await seedSupabaseUsers()
  if (await users.getByEmail('teacher@gradeant.dev')) return // already seeded

  const now = isoUtc()
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  for (const [uid, email, name, role] of PEOPLE) {
    if ((await users.get(uid)) || (await users.getByEmail(email))) continue
    await users.create({
      user_id: uid,
      email,
      name,
      role,
      account_status: 'active',
      password_hash: passwordHash,
      school: 'Lincoln HS',
      created_at: now,
    })
  }

  if (await assignments.get('A-thermo')) return
  await classes.create({ class_id: 'C-phy204', name: 'PHY-204', subject: 'Physics', teacher_id: 'T1', created_by: 'A1', created_at: now })
  for (const [uid, , , , enrolled] of PEOPLE) {
    if (enrolled) await classes.addMember({ class_id: 'C-phy204', student_id: uid, added_by: 'T1', added_at: now })
  }

  const assignment = {
    assignment_id: 'A-thermo',
    qp_id: 'QP-thermo',
    title: 'Thermodynamics HW',
    class_id: 'C-phy204',
    class_name: 'PHY-204',
    teacher_id: 'T1',
    due_at: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    method: 'standard',
    persona: 'balanced',
    partial_credit: true,
    content_status: 'published',
    grades_status: 'teacher_reviewing',
    created_at: now,
    qp_status: 'rubric_reviewed',
  }
  await createAssignment(assignment)
  await papers.update('QP-thermo', {
    rubric: [
      { question_number: 1, max_marks: 5, title: 'Internal energy', criteria: 'Defines U as the total energy of the system; unit J.' },
      { question_number: 2, max_marks: 5, title: 'First law', criteria: 'ΔU = Q − W with a stated sign convention.' },
      { question_number: 3, max_marks: 10, title: 'Isothermal work', criteria: 'W = nRT ln(V2/V1) ≈ 1729 J; correct sign and units.' },
    ],
    rubric_reviewed_by: 'T1',
    rubric_reviewed_at: now,
  })
  for (const [qn, question, maxMarks] of QUESTIONS) {
    await papers.putQuestion({ qp_id: 'QP-thermo', question_number: qn, question, max_marks: maxMarks, ocr_confidence: 0.98 })
  }

  await announcements.create({
    announcement_id: 'N-welcome',
    class_id: 'C-phy204',
    class_name: 'PHY-204',
    title: 'Welcome to PHY-204',
    message: 'Thermodynamics HW is open. Photograph every page of your working and upload it before the due date.',
    author_id: 'T1',
    author_name: 'Dr. Priya Nair',
    created_at: now,
  })

  // Graded an hour ago by the (external) grading pipeline.
  const gradedAt = isoUtc(new Date(Date.now() - 3600_000))
  for (const [sid, rows] of Object.entries(RESULTS)) {
    const submissionId = `${sid}-summary`
    await submissions.create({
      submission_id: submissionId,
      assignment_id: 'A-thermo',
      qp_id: 'QP-thermo',
      student_id: sid,
      total_marks: rows.reduce((total, r) => total + r[0], 0),
      graded_at: gradedAt,
      submitted_at: gradedAt,
      pages: 2,
      created_at: gradedAt,
    })
    for (let i = 0; i < QUESTIONS.length; i++) {
      const [qn, , maxMarks] = QUESTIONS[i]
      const [marks, answer, feedback, confidence] = rows[i]
      await submissions.putAnswer({
        answer_id: `${sid}-${qn}`,
        submission_id: submissionId,
        question_number: qn,
        status: 'corrected',
        student_answer: answer,
        max_marks: maxMarks,
        marks,
        feedback,
        confidence,
        created_at: gradedAt,
      })
    }
  }
  console.log(JSON.stringify({ level: 'info', msg: `seeded demo data (password for demo users: ${DEMO_PASSWORD})` }))
}
