import { Router } from 'express'
import config from '../config/index.js'
import { health, ready } from '../controllers/health.controller.js'
import { LOCAL_STORAGE_ROUTE } from '../aws/s3.js'
import authRoutes from './auth.routes.js'
import localStorageRoutes from './localStorage.routes.js'
import operationRoutes from './operations.routes.js'
import uploadRoutes from './upload.routes.js'

const router = Router()

router.get('/health', health)
router.get('/health/ready', ready)

router.use('/auth', authRoutes)
router.use('/uploadpdf', uploadRoutes)
router.use(operationRoutes)

if (config.drivers.storage === 'local') router.use(LOCAL_STORAGE_ROUTE, localStorageRoutes)

export default router
