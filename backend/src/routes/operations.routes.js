// Single-resource "operation dispatch" APIs, each replacing one Python Lambda:
//   POST /getgrades      (get_grades.py)                errors: {"error": ...}
//   POST /correctanswer  (correct_questions_answer.py)  errors: {"error": ...}
//   POST /updatedb       (update_db.py)                 errors: {"error": ...}
//   POST /admin          (admin/lambda_admin.py)        errors: {"message": ...}
//   POST /workflow       (workflow.py)                  errors: {"error": ...}
import { Router } from 'express'
import { adminOperation } from '../controllers/admin.controller.js'
import { operationsController } from '../controllers/operations.controller.js'
import { errorHandler, jsonBody } from '../middleware/errors.js'
import { operations as correctionOps } from '../services/correction.service.js'
import { operations as gradesOps } from '../services/grades.service.js'
import { operations as marksOps } from '../services/marks.service.js'
import { operations as workflowOps } from '../services/workflow/index.js'

function resource(controller, errorShape) {
  const router = Router()
  router.use(jsonBody())
  router.post('/', controller)
  router.use(errorHandler(errorShape))
  return router
}

const router = Router()
router.use('/getgrades', resource(operationsController(gradesOps), { key: 'error', invalidJson: 'Invalid JSON format' }))
router.use('/correctanswer', resource(operationsController(correctionOps), { key: 'error', invalidJson: 'Invalid JSON format' }))
router.use('/updatedb', resource(operationsController(marksOps), { key: 'error', invalidJson: 'Invalid JSON format' }))
router.use('/workflow', resource(operationsController(workflowOps, { internalMessage: 'Internal error' }), { key: 'error', invalidJson: 'Invalid JSON format' }))
router.use(
  '/admin',
  resource(adminOperation, { key: 'message', invalidJson: 'Request body must be valid JSON.', internal: 'Internal server error.' }),
)

export default router
