import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import PageScope from '../../components/PageScope'
import Spinner from '../../components/Spinner'
import { requestPasswordReset } from '../../lib/account'
import '../../styles/pages/auth.css'
import AuthNavbar from './AuthNavbar'

/**
 * Wireframe §07 "Forgot Password — request only". Teachers and students can't
 * reset their own password; this forwards a request to an administrator, who
 * approves it and issues a temporary password.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return setError('Please enter your email address.')

    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageScope name="auth" className="auth-page" title="Reset Password">
      <AuthNavbar active="login" />

      <section className="auth-section">
        <div className="container">
          <div className="auth-container">
            <div className="auth-form-container">
              <div className="auth-brand-row">
                <span className="auth-logo-mark" />
                <span className="auth-logo-word">GradeAnt</span>
              </div>

              {sent ? (
                <>
                  <h1>Request sent</h1>
                  <div className="alert alert-success" role="status">
                    Your password reset request has been sent to the administrator.
                  </div>
                  <p className="auth-subtitle">
                    Once it's approved you'll receive a temporary password. You'll be asked to choose a new one the
                    first time you log in with it.
                  </p>
                  <p className="auth-switch">
                    <Link to="/login">Back to login</Link>
                  </p>
                </>
              ) : (
                <>
                  <h1>Reset your password</h1>
                  <p className="auth-subtitle">We'll forward your request to an administrator for approval.</p>

                  {error && (
                    <div className="alert alert-error" role="alert">
                      {error}
                    </div>
                  )}

                  <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label htmlFor="email">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                      Submit Request
                    </button>
                  </form>

                  <p className="auth-switch">
                    Remembered it? <Link to="/login">Log in</Link>
                  </p>
                </>
              )}
            </div>

            <div className="auth-image">
              <img src="/img/Login_Illustration.jpg" alt="Login Illustration" />
            </div>
          </div>
        </div>
      </section>

      <Spinner show={loading} />
    </PageScope>
  )
}
