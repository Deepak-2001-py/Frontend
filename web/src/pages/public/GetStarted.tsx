import { useRef } from 'react'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/pages/getstarted.css'

/** Converted from quick_links/getstarted.html; its inline script lives in useStaticPageBehaviors. */
export default function GetStarted() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root)

  return (
    <PageScope name="getstarted" title="Get Started" rootRef={root}>
      <section className="cta-section" id="getstarted">
        <div className="container">
          <h2 className="cta-title">Ready to Transform Your Grading Experience?</h2>
          <p className="cta-description">
            Join thousands of educators who have reclaimed their time while providing better feedback to students.
          </p>
          <button data-nav-to="/login" className="btn cta-button pulse" id="getStartedButton">
            Get Started Today{' '}
            <span>→</span>
          </button>
        </div>
      </section>
    </PageScope>
  )
}
