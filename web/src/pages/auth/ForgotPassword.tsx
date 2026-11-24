import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
<<<<<<< HEAD
import { requestPasswordReset } from '../../lib/account'
import { AuthShell, Notice, StepsPreview } from './AuthLayout'
=======
import PageScope from '../../components/PageScope'
import Spinner from '../../components/Spinner'
import { requestPasswordReset } from '../../lib/account'
import '../../styles/pages/auth.css'
import AuthNavbar from './AuthNavbar'
>>>>>>> origin/main

/**
 * Wireframe §07 "Forgot Password — request only". Teachers and students can't
 * reset their own password; this forwards a request to an administrator, who
<<<<<<< HEAD
 * approves it and issues a temporary password. The right-hand column shows that
 * process, and ticks off the first step once the request is sent.
 */
const STEPS: [string, string][] = [
  ['Send a reset request', 'Enter the email you log in with.'],
  ['Your administrator approves it', 'Requests go to your school’s GradeAnt administrator.'],
  ['You get a temporary password', 'Your administrator passes it on to you.'],
  ['Choose a new password', 'You’ll be asked to set your own the first time you log in with it.'],
]

=======
 * approves it and issues a temporary password.
 */
>>>>>>> origin/main
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
<<<<<<< HEAD
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address) return setError('Enter the email you log in with.')
=======
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return setError('Please enter your email address.')
>>>>>>> origin/main

    setLoading(true)
    setError(null)
    try {
<<<<<<< HEAD
      await requestPasswordReset(address)
      setSentTo(address)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Your request didn’t go through. Try again.')
=======
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request. Please try again.')
>>>>>>> origin/main
    } finally {
      setLoading(false)
    }
  }

<<<<<<< HEAD
  function startOver() {
    setSentTo(null)
    setEmail('')
    setError(null)
  }

  const aside = (
    <StepsPreview
      k={sentTo ? 'reset-sent' : 'reset-form'}
      title={sentTo ? 'Request sent. Here’s what happens next' : 'How a password reset works'}
      text={sentTo ? 'Your administrator has it now.' : 'For security, an administrator approves every reset.'}
      steps={STEPS}
      done={sentTo ? 1 : 0}
    />
  )

  return (
    <AuthShell title="Reset password" aside={aside}>
      {sentTo ? (
        <>
          <h1>Request sent</h1>
          <Notice tone="success">
            If <b>{sentTo}</b> has a GradeAnt account, your administrator now has a request to reset its password.
          </Notice>
          <p className="au-lead" style={{ marginTop: 18 }}>
            Once they approve it, they’ll give you a temporary password. Log in with it and you’ll be asked to choose a
            new one.
          </p>
          <div className="lp-form au-form">
            <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg au-submit">
              Back to log in
            </Link>
            <button type="button" className="lp-btn lp-btn-secondary lp-btn-lg au-submit" onClick={startOver}>
              Use a different email
            </button>
          </div>
        </>
      ) : (
        <>
          <h1>Reset your password</h1>
          <p className="au-lead">We’ll send your request to your administrator for approval.</p>

          {error && <Notice tone="error">{error}</Notice>}

          <form className="lp-form au-form" onSubmit={handleSubmit} noValidate>
            <div className="lp-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                className="lp-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
              />
            </div>
            <button type="submit" className="lp-btn lp-btn-primary lp-btn-lg au-submit" disabled={loading}>
              {loading ? 'Sending request…' : 'Send reset request'}
            </button>
          </form>

          <p className="au-switch">
            Remembered it?{' '}
            <Link to="/login" className="au-link">
              Log in
            </Link>
          </p>
          <p className="au-switch" style={{ marginTop: 8 }}>
            This is for teacher and student accounts. Administrators change their password from their profile.
          </p>
        </>
      )}
    </AuthShell>
=======
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
>>>>>>> origin/main
  )
}
