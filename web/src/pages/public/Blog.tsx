import { useRef } from 'react'
import { Link } from 'react-router-dom'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/themes/site.css'

/** Converted from resoures/blog.html; its inline script lives in useStaticPageBehaviors. */
export default function Blog() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root)

  return (
    <PageScope name="blog" theme="site" title="Blog" rootRef={root}>
      <nav className="navbar">
        <div className="container navbar-container">
          <Link to="/" className="logo-container">
            <img src="/img/Designer.jpeg" alt="GradeAnt Logo" className="logo-image" />
            <h1 className="logo">
              Grade
              <span>Ant</span>
            </h1>
          </Link>
          {' '}
          <button className="mobile-menu-btn" id="mobileMenuBtn">☰</button>
          <div className="nav-links" id="navLinks">
            <Link to="/about">About</Link>
            {' '}
            <Link to="/blog" className="active">Blog</Link>
            {' '}
            <Link to="/contact">Contact</Link>
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-secondary">Login</Link>
              {' '}
              <Link to="/signup" className="btn btn-primary">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>
      <section className="page-hero blog-hero">
        <div className="container">
          <h1>GradeAnt Blog</h1>
          <p>Insights, tips, and stories from the world of education and AI.</p>
        </div>
      </section>
      <section className="blog-categories">
        <div className="container">
          <div className="category-tabs">
            <button className="category-tab active">All</button>
            {' '}
            <button className="category-tab">Teaching Tips</button>
            {' '}
            <button className="category-tab">EdTech</button>
            {' '}
            <button className="category-tab">Assessment</button>
            {' '}
            <button className="category-tab">AI in Education</button>
          </div>
        </div>
      </section>
      <section className="featured-post">
        <div className="container">
          <div className="featured-post-card">
            <div className="featured-post-image">
              <img src="/img/blog-featured.jpg" alt="Featured Blog Post" />
            </div>
            <div className="featured-post-content">
              <span className="post-category">AI in Education</span>
              <h2>How AI is Transforming Student Feedback in 2025</h2>
              <p className="post-meta">By Sarah Chen • April 5, 2025 • 8 min read</p>
              <p className="post-excerpt">
                The landscape of student feedback is changing rapidly as AI tools become more sophisticated. Here's how educators are using these technologies to provide more personalized, timely feedback...
              </p>
              <a href="#" className="btn btn-secondary">Read More</a>
            </div>
          </div>
        </div>
      </section>
      <section className="blog-posts">
        <div className="container">
          <div className="posts-grid">
            <div className="blog-post-card">
              <div className="post-image">
                <img src="/img/blog-post-1.jpg" alt="Blog Post" />
              </div>
              <div className="post-content">
                <span className="post-category">Teaching Tips</span>
                <h3>5 Strategies to Reduce Grading Time Without Sacrificing Quality</h3>
                <p className="post-meta">By Alex Johnson • April 2, 2025</p>
                <p className="post-excerpt">
                  Discover practical approaches to streamline your grading process while maintaining meaningful feedback...
                </p>
                <a href="#" className="read-more">Read More →</a>
              </div>
            </div>
            <div className="blog-post-card">
              <div className="post-image">
                <img src="/img/blog-post-2.jpg" alt="Blog Post" />
              </div>
              <div className="post-content">
                <span className="post-category">Assessment</span>
                <h3>The Future of Formative Assessment in the AI Era</h3>
                <p className="post-meta">By Lisa Patel • March 28, 2025</p>
                <p className="post-excerpt">
                  How intelligent assessment tools are changing the way we approach formative evaluation...
                </p>
                <a href="#" className="read-more">Read More →</a>
              </div>
            </div>
            <div className="blog-post-card">
              <div className="post-image">
                <img src="/img/blog-post-3.jpg" alt="Blog Post" />
              </div>
              <div className="post-content">
                <span className="post-category">EdTech</span>
                <h3>Integrating GradeAnt with Your Existing LMS: A Complete Guide</h3>
                <p className="post-meta">By Miguel Rodriguez • March 21, 2025</p>
                <p className="post-excerpt">
                  Step-by-step instructions to seamlessly connect GradeAnt with popular learning management systems...
                </p>
                <a href="#" className="read-more">Read More →</a>
              </div>
            </div>
            <div className="blog-post-card">
              <div className="post-image">
                <img src="/img/blog-post-4.jpg" alt="Blog Post" />
              </div>
              <div className="post-content">
                <span className="post-category">AI in Education</span>
                <h3>Addressing Bias in AI-Assisted Grading: Best Practices</h3>
                <p className="post-meta">By Sarah Chen • March 15, 2025</p>
                <p className="post-excerpt">
                  Understanding potential sources of bias in AI systems and how to mitigate them...
                </p>
                <a href="#" className="read-more">Read More →</a>
              </div>
            </div>
            <div className="blog-post-card">
              <div className="post-image">
                <img src="/img/blog-post-5.jpg" alt="Blog Post" />
              </div>
              <div className="post-content">
                <span className="post-category">Teaching Tips</span>
                <h3>Creating Rubrics That Work With AI Grading Assistants</h3>
                <p className="post-meta">By Alex Johnson • March 8, 2025</p>
                <p className="post-excerpt">How to design effective rubrics that complement AI-powered assessment tools...</p>
                <a href="#" className="read-more">Read More →</a>
              </div>
            </div>
            <div className="blog-post-card">
              <div className="post-image">
                <img src="/img/blog-post-6.jpg" alt="Blog Post" />
              </div>
              <div className="post-content">
                <span className="post-category">Assessment</span>
                <h3>Beyond Multiple Choice: AI-Assisted Grading for Complex Assignments</h3>
                <p className="post-meta">By Lisa Patel • March 1, 2025</p>
                <p className="post-excerpt">
                  Exploring how AI can help evaluate essays, projects, and other open-ended work...
                </p>
                <a href="#" className="read-more">Read More →</a>
              </div>
            </div>
          </div>
          <div className="pagination">
            <a href="#" className="active">1</a>
            {' '}
            <a href="#">2</a>
            {' '}
            <a href="#">3</a>
            {' '}
            <span className="pagination-dots">...</span>
            {' '}
            <a href="#">9</a>
            {' '}
            <a href="#" className="pagination-next">Next →</a>
          </div>
        </div>
      </section>
      <section className="newsletter-section">
        <div className="container">
          <div className="newsletter-content">
            <h2>Subscribe to Our Newsletter</h2>
            <h3>Upcoming...</h3>
            <p>
              Get the latest insights on education, AI, and grading strategies delivered to your inbox.
            </p>
            <form className="newsletter-form">
              <input type="email" placeholder="Your email address" required />
              {' '}
              <button type="submit" className="btn btn-primary">Subscribe</button>
            </form>
          </div>
        </div>
      </section>
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <h2 className="logo">
                Grade
                <span>Ant</span>
              </h2>
              <p>Making grading smarter and faster.</p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h3>Product</h3>
                <Link to="/features">Features</Link>
                {' '}
                <Link to="/demo">Demo</Link>
              </div>
              <div className="footer-column">
                <h3>Company</h3>
                <Link to="/about">About</Link>
                {' '}
                <Link to="/blog">Blog</Link>
                {' '}
                <Link to="/contact">Contact</Link>
              </div>
              <div className="footer-column">
                <h3>Legal</h3>
                <Link to="/terms">Terms</Link>
                {' '}
                <Link to="/privacy">Privacy</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 GradeAnt. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </PageScope>
  )
}
