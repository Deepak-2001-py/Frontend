// DynamoDB expression parser + evaluator for the Postgres driver (pure: no I/O).
//
// Supports exactly the grammar the services use (backend/SUPABASE_NETLIFY_PLAN.md §1.3):
//   UpdateExpression     SET p = :v [, p = if_not_exists(p, :v)] [REMOVE p, …]   (keywords any case)
//   ConditionExpression  attribute_exists(p) | attribute_not_exists(p) | p = :v | p <> :v | p IN (:a, …)
//   FilterExpression     the same comparisons joined by AND
//   KeyConditionExpression  p = :v
//   ProjectionExpression a, #b, …
// p is a top-level attribute name or a #alias. Anything else throws UnsupportedExpression,
// so a new construct in a service fails loudly in tests instead of silently misbehaving.
//
// Semantics copied from DynamoDB (probed against the emulator, see test/dataDrivers.test.js):
//   - a missing attribute makes `=` and IN false and `<>` true
//   - values compare with their type (the string "1" is not the number 1); null equals null
//   - if_not_exists(p, :v) keeps a stored null (only a missing attribute takes :v)

export class UnsupportedExpression extends Error {
  constructor(message, expression) {
    super(`${message}${expression ? ` in "${expression}"` : ''}`)
    this.name = 'UnsupportedExpression'
  }
}

const TOKEN = /\s*(<>|[(),=]|#[A-Za-z0-9_]+|:[A-Za-z0-9_]+|[A-Za-z_][A-Za-z0-9_-]*|\S)/y

function tokenize(text) {
  const tokens = []
  TOKEN.lastIndex = 0
  const source = String(text ?? '')
  while (TOKEN.lastIndex < source.length) {
    const start = TOKEN.lastIndex
    const m = TOKEN.exec(source)
    if (!m) {
      if (/^\s*$/.test(source.slice(start))) break
      throw new UnsupportedExpression(`Unexpected text "${source.slice(start)}"`, source)
    }
    tokens.push(m[1])
  }
  return tokens
}

class Reader {
  constructor(text, used) {
    this.text = text
    this.used = used // Set collecting the #names and :values this request references
    this.tokens = tokenize(text)
    this.i = 0
  }
  peek() {
    return this.tokens[this.i]
  }
  next() {
    return this.tokens[this.i++]
  }
  done() {
    return this.i >= this.tokens.length
  }
  expect(token) {
    const t = this.next()
    if (t !== token) throw new UnsupportedExpression(`Expected "${token}" but found "${t ?? 'end'}"`, this.text)
  }
  isKeyword(word) {
    return typeof this.peek() === 'string' && this.peek().toUpperCase() === word
  }
  path(names) {
    const t = this.next()
    if (t === undefined) throw new UnsupportedExpression('Expected an attribute name', this.text)
    if (['.', '['].includes(this.peek())) throw new UnsupportedExpression('Nested attribute paths are not supported', this.text)
    if (t.startsWith('#')) {
      if (!names || !Object.hasOwn(names, t)) throw new UnsupportedExpression(`Unknown attribute name ${t}`, this.text)
      this.used?.add(t)
      return names[t]
    }
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(t)) throw new UnsupportedExpression(`Expected an attribute name but found "${t}"`, this.text)
    return t
  }
  value(values) {
    const t = this.next()
    if (!t || !t.startsWith(':')) throw new UnsupportedExpression(`Expected a :value but found "${t ?? 'end'}"`, this.text)
    if (!values || !Object.hasOwn(values, t)) throw new UnsupportedExpression(`Unknown value ${t}`, this.text)
    this.used?.add(t)
    return values[t]
  }
}

/** Deep, type-strict equality (DynamoDB compares typed values). */
export function sameValue(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]))
}

const has = (item, attr) => item !== undefined && item !== null && Object.hasOwn(item, attr)

/** Parses a condition/filter into a predicate (item → boolean). */
export function compileCondition(expression, names, values, used) {
  if (!expression) return () => true
  const r = new Reader(expression, used)
  const terms = [term(r, names, values)]
  while (!r.done()) {
    if (!r.isKeyword('AND')) throw new UnsupportedExpression(`Only AND is supported between conditions (found "${r.peek()}")`, expression)
    r.next()
    terms.push(term(r, names, values))
  }
  return (item) => terms.every((t) => t(item))
}

function term(r, names, values) {
  const head = r.peek()
  if (head === '(') throw new UnsupportedExpression('Parentheses are not supported', r.text)
  if (typeof head === 'string' && /^(attribute_exists|attribute_not_exists)$/.test(head)) {
    r.next()
    r.expect('(')
    const attr = r.path(names)
    r.expect(')')
    return head === 'attribute_exists' ? (item) => has(item, attr) : (item) => !has(item, attr)
  }
  if (typeof head === 'string' && /^[a-z_]+$/.test(head) && r.tokens[r.i + 1] === '(') {
    throw new UnsupportedExpression(`Function ${head}() is not supported`, r.text)
  }
  const attr = r.path(names)
  if (r.isKeyword('IN')) {
    r.next()
    r.expect('(')
    const list = [r.value(values)]
    while (r.peek() === ',') {
      r.next()
      list.push(r.value(values))
    }
    r.expect(')')
    return (item) => has(item, attr) && list.some((v) => sameValue(item[attr], v))
  }
  const op = r.next()
  if (op === '=') {
    const v = r.value(values)
    return (item) => has(item, attr) && sameValue(item[attr], v)
  }
  if (op === '<>') {
    const v = r.value(values)
    return (item) => !has(item, attr) || !sameValue(item[attr], v)
  }
  throw new UnsupportedExpression(`Operator "${op ?? 'end'}" is not supported`, r.text)
}

/** KeyConditionExpression "p = :v" → { attr, value }. */
export function parseKeyCondition(expression, names, values, used) {
  const r = new Reader(expression, used)
  const attr = r.path(names)
  r.expect('=')
  const value = r.value(values)
  if (!r.done()) throw new UnsupportedExpression('Only "key = :value" key conditions are supported', expression)
  return { attr, value }
}

/** ProjectionExpression "a, #b" → ['a', 'b']. */
export function parseProjection(expression, names, used) {
  const r = new Reader(expression, used)
  const attrs = [r.path(names)]
  while (!r.done()) {
    r.expect(',')
    attrs.push(r.path(names))
  }
  return attrs
}

/** Parses an UpdateExpression into a function (current item | undefined, key) → new item. */
export function compileUpdate(expression, names, values, used) {
  const r = new Reader(expression, used)
  const sets = []
  const removes = []
  const seen = new Set()
  if (r.done()) throw new UnsupportedExpression('Empty update expression', expression)
  while (!r.done()) {
    const clause = String(r.next()).toUpperCase()
    if (seen.has(clause)) throw new UnsupportedExpression(`${clause} appears twice`, expression)
    seen.add(clause)
    if (clause === 'SET') {
      do {
        if (sets.length) r.next() // the comma
        const attr = r.path(names)
        r.expect('=')
        if (r.peek() === 'if_not_exists') {
          r.next()
          r.expect('(')
          const checked = r.path(names)
          r.expect(',')
          const fallback = r.value(values)
          r.expect(')')
          sets.push({ attr, ifNotExists: checked, value: fallback })
        } else {
          sets.push({ attr, value: r.value(values) })
        }
        if (['+', '-'].includes(r.peek())) throw new UnsupportedExpression('Arithmetic in SET is not supported', expression)
      } while (r.peek() === ',')
    } else if (clause === 'REMOVE') {
      removes.push(r.path(names))
      while (r.peek() === ',') {
        r.next()
        removes.push(r.path(names))
      }
    } else {
      throw new UnsupportedExpression(`Update clause ${clause} is not supported`, expression)
    }
  }
  return (current, key) => {
    const item = current === undefined ? { ...key } : structuredClone(current)
    // Right-hand sides read the item as it was before this update (DynamoDB semantics).
    for (const s of sets) {
      if (s.ifNotExists !== undefined && has(current, s.ifNotExists)) item[s.attr] = structuredClone(current[s.ifNotExists])
      else item[s.attr] = structuredClone(s.value)
    }
    for (const attr of removes) delete item[attr]
    return item
  }
}

/**
 * DynamoDB rejects a request whose ExpressionAttributeNames / ExpressionAttributeValues hold an
 * entry no expression uses. Call after compiling every expression of the request with `used`.
 */
export function checkAllUsed(names, values, used) {
  const unusedNames = Object.keys(names ?? {}).filter((k) => !used.has(k))
  const unusedValues = Object.keys(values ?? {}).filter((k) => !used.has(k))
  const problem = unusedNames.length
    ? `Value provided in ExpressionAttributeNames unused in expressions: keys: {${unusedNames.join(', ')}}`
    : unusedValues.length
      ? `Value provided in ExpressionAttributeValues unused in expressions: keys: {${unusedValues.join(', ')}}`
      : ''
  if (problem) throw Object.assign(new Error(problem), { name: 'ValidationException' })
}

/** removeUndefinedValues: drop undefined from objects and arrays, recursively (as the document client does). */
export function stripUndefined(value) {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map(stripUndefined)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = stripUndefined(v)
    return out
  }
  return value
}
