// Teacher → class announcements; students read the ones for their classes.
import { randomUUID } from 'node:crypto'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import { pyStr, sortBy, trunc, truthy } from '../../lib/py.js'
import { studentClasses } from '../../repositories/gradebook.js'
import { announcements, classes } from '../../repositories/index.js'
import { myAssignments, now, required, requireRole, visibleAssignments } from './context.js'

export async function postAnnouncement(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [className, title, message] = required(body, 'class_name', 'title', 'message')
  const mine = new Set((await myAssignments(caller)).map((a) => a.class_name))
  if (caller.role !== 'admin' && !mine.has(className)) {
    throw badRequest('Create an assignment for that class first, then you can post to it.')
  }
  const cls = await classes.getByName(pyStr(className))
  const item = {
    announcement_id: `N-${randomUUID().replace(/-/g, '').slice(0, 10)}`,
    ...(cls ? { class_id: cls.class_id } : {}),
    class_name: trunc(pyStr(className), 100),
    title: trunc(pyStr(title).trim(), 150),
    message: trunc(pyStr(message).trim(), 2000),
    author_id: caller.user_id,
    author_name: caller.user.name || 'Teacher',
    created_at: now(),
  }
  if (!item.title || !item.message) throw badRequest('A title and a message are required.')
  await announcements.create(item)
  return { announcement: item }
}

export async function listAnnouncements(body, caller) {
  let items
  if (caller.role === 'student') {
    // The student's classes, and the classes of any assignment they can see.
    const names = new Set((await studentClasses(caller.user_id)).map((c) => c.name))
    for (const a of await visibleAssignments(caller)) if (truthy(a.class_name)) names.add(a.class_name)
    items = names.size ? await announcements.listByClassNames(sortBy([...names], (c) => c)) : []
  } else {
    requireRole(caller, 'teacher', 'admin')
    items = caller.role === 'admin' ? await announcements.listAll() : await announcements.listByAuthor(caller.user_id)
  }
  return { announcements: sortBy(items, (a) => a.created_at ?? '', { reverse: true }).slice(0, 50) }
}

export async function deleteAnnouncement(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [announcementId] = required(body, 'announcement_id')
  const item = await announcements.get(announcementId)
  if (!item) throw notFound('Announcement not found.')
  if (caller.role !== 'admin' && item.author_id !== caller.user_id) throw forbidden('You can only delete your own announcements.')
  await announcements.delete(announcementId)
  return { ok: true }
}
