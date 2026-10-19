// /auth/* (was authetication.py). Errors are {"message": "..."}.
import { Router } from 'express'
import * as c from '../controllers/auth.controller.js'
import { errorHandler, jsonBody } from '../middleware/errors.js'

const router = Router()
router.use(jsonBody())
router.post('/signup', c.signup)
router.post('/login', c.login)
router.post('/logout', c.logout)
router.post('/forgot-password', c.forgotPassword)
router.post('/change-password', c.changePassword)
router.post('/me', c.me)
router.post('/profile-photo', c.profilePhoto)
router.use((req, res) => res.status(404).json({ message: 'Not Found' }))
router.use(errorHandler({ key: 'message' }))

export default router
