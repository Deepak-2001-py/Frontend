import { useRef } from 'react'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/pages/demo.css'

/** Converted from quick_links/demo.html; its inline script lives in useStaticPageBehaviors. */
export default function Demo() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root)

  return (
    <PageScope name="demo" title="Demo" rootRef={root}>
      <div className="container">
        <h1>Grade-Ant Dashboard</h1>
        <div className="options">
          <div className="option">
            <img src="/img/Screenshot 2025-04-03 164627.png" alt="Upload Assignment / Question Paper" />
            <div className="option-content">
              <h3>Upload Assignment / Question Paper</h3>
              <button data-nav-to="/teacher/upload">Go to Upload</button>
            </div>
          </div>
          <div className="option">
            <img src="/img/ChatGPT Image Apr 3, 2025, 04_52_22 PM.png" alt="View Grades" />
            <div className="option-content">
              <h3>View Grades</h3>
              <button data-nav-to="/teacher/grades">Go to Grades</button>
            </div>
          </div>
        </div>
      </div>
    </PageScope>
  )
}
