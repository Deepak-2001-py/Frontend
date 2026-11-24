// DynamoDB table → Postgres table (schema gradeant, backend/sql/001_schema.sql).
// Keys are the DynamoDB key attributes (hash, then range); each index maps a
// DynamoDB index name to the (generated) column holding its hash key.
import config from '../config/index.js'

const SPECS = {
  users: { pg: 'users', keys: ['email'] },
  grading: {
    pg: 'assignment_grading',
    keys: ['evaluation_id'],
    indexes: () => ({
      'student_id-index': 'student_id',
      'type-index': 'type',
      [config.tables.gradingAssignmentIndex]: 'assignment_id',
    }),
  },
  assignments: { pg: 'assignments', keys: ['assignment_id'], indexes: () => ({ 'teacher_id-index': 'teacher_id' }) },
  submissions: { pg: 'submissions', keys: ['assignment_id', 'student_id'], indexes: () => ({ 'student_id-index': 'student_id' }) },
  announcements: { pg: 'announcements', keys: ['announcement_id'] },
  adminUsers: { pg: 'admin_users', keys: ['user_id'] },
  resetRequests: { pg: 'reset_requests', keys: ['request_id'] },
  content: { pg: 'content', keys: ['post_id'] },
  tickets: { pg: 'tickets', keys: ['ticket_id'] },
  auditLogs: { pg: 'audit_logs', keys: ['log_id'] },
  settings: { pg: 'settings', keys: ['setting_key'] },
  invites: { pg: 'invites', keys: ['token'] },
  analytics: { pg: 'analytics', keys: ['metric_key'] },
}

export const SCHEMA = 'gradeant'

/** The spec for a DynamoDB table name (as configured in config.tables), resolved at call time. */
export function specForTableName(name) {
  const key = Object.keys(SPECS).find((k) => config.tables[k] === name)
  if (!key) {
    const err = new Error(`Requested resource not found: Table: ${name} not found`)
    err.name = 'ResourceNotFoundException'
    throw err
  }
  const spec = SPECS[key]
  return { key, table: spec.pg, keys: spec.keys, indexes: spec.indexes ? spec.indexes() : {} }
}

export const allTables = () => Object.values(SPECS).map((s) => s.pg)
