import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CtaBand, LandingPage, PageHero } from '../../components/landing/LandingKit'
import { EASE } from '../../components/landing/motion'

type Category = 'AI in Education' | 'Teaching Tips' | 'Assessment' | 'EdTech'

interface Post {
  category: Category
  title: string
  excerpt: string
  author: string
  date: string
  readTime?: string
}

// Article pages aren't written yet, so cards are marked "Coming soon" rather than linking nowhere.
const POSTS: Post[] = [
  {
    category: 'AI in Education',
    title: 'How AI is transforming student feedback in 2025',
    excerpt:
      'The landscape of student feedback is changing rapidly as AI tools become more sophisticated. Here is how educators are using them to give more personalised, timely feedback.',
    author: 'Sarah Chen',
    date: 'April 5, 2025',
    readTime: '8 min read',
  },
  {
    category: 'Teaching Tips',
    title: '5 strategies to reduce grading time without sacrificing quality',
    excerpt: 'Practical approaches to streamline your grading while keeping feedback meaningful.',
    author: 'Alex Johnson',
    date: 'April 2, 2025',
  },
  {
    category: 'Assessment',
    title: 'The future of formative assessment in the AI era',
    excerpt: 'How intelligent assessment tools are changing the way we approach formative evaluation.',
    author: 'Lisa Patel',
    date: 'March 28, 2025',
  },
  {
    category: 'EdTech',
    title: 'Integrating GradeAnt with your existing LMS: a complete guide',
    excerpt: 'Step-by-step instructions for connecting GradeAnt with popular learning management systems.',
    author: 'Miguel Rodriguez',
    date: 'March 21, 2025',
  },
  {
    category: 'AI in Education',
    title: 'Addressing bias in AI-assisted grading: best practices',
    excerpt: 'Where bias can creep into AI systems — and how to spot and mitigate it.',
    author: 'Sarah Chen',
    date: 'March 15, 2025',
  },
  {
    category: 'Teaching Tips',
    title: 'Creating rubrics that work with AI grading assistants',
    excerpt: 'How to design rubrics that complement AI-powered assessment tools.',
    author: 'Alex Johnson',
    date: 'March 8, 2025',
  },
  {
    category: 'Assessment',
    title: 'Beyond multiple choice: AI-assisted grading for complex assignments',
    excerpt: 'How AI can help evaluate essays, projects and other open-ended work.',
    author: 'Lisa Patel',
    date: 'March 1, 2025',
  },
]

const COVERS: Record<Category, { cls: string; icon: string }> = {
  'AI in Education': { cls: 'lp-cover-ai', icon: 'auto_awesome' },
  'Teaching Tips': { cls: 'lp-cover-tips', icon: 'tips_and_updates' },
  Assessment: { cls: 'lp-cover-assess', icon: 'fact_check' },
  EdTech: { cls: 'lp-cover-edtech', icon: 'devices' },
}

const FILTERS: ('All' | Category)[] = ['All', 'Teaching Tips', 'EdTech', 'Assessment', 'AI in Education']

function PostCard({ post, featured }: { post: Post; featured?: boolean }) {
  const cover = COVERS[post.category]
  return (
    <motion.article
      layout
      className={`lp-post${featured ? ' is-featured' : ''}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: EASE }}
      whileHover={{ y: -6 }}
    >
      <div className={`lp-post-cover ${cover.cls}`} aria-hidden>
        <span className="material-icons">{cover.icon}</span>
      </div>
      <div className="lp-post-body">
        <span className="lp-post-cat">{post.category}</span>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <div className="lp-post-meta">
          By {post.author} · {post.date}
          {post.readTime ? ` · ${post.readTime}` : ''}
        </div>
        <span className="lp-soon">Full article coming soon</span>
      </div>
    </motion.article>
  )
}

export default function Blog() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const shown = POSTS.filter((p) => filter === 'All' || p.category === filter)
  const [featured, ...rest] = shown

  return (
    <LandingPage title="Blog">
      <PageHero
        eyebrow="GradeAnt blog"
        title={
          <>
            Ideas for the <span className="lp-gradient-text">modern classroom</span>
          </>
        }
        lead="Insights, tips and stories from the world of education and AI."
      />

      <section className="lp-section" style={{ paddingTop: 8 }}>
        <div className="lp-container">
          <div className="lp-chips" role="tablist" aria-label="Filter posts by category">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={`lp-chip-btn${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {filter === f && <motion.span layoutId="lp-chip-bg" className="lp-chip-bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span>{f}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="popLayout">
            {featured && <PostCard key={`featured-${featured.title}`} post={featured} featured />}
          </AnimatePresence>
          <motion.div layout className="lp-cards">
            <AnimatePresence mode="popLayout">
              {rest.map((p) => (
                <PostCard key={p.title} post={p} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <motion.div
            className="lp-newsletter"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div>
              <h2>Subscribe to our newsletter</h2>
              <p>The latest on education, AI and grading strategy — launching soon.</p>
            </div>
            <form onSubmit={(e) => e.preventDefault()} aria-label="Newsletter (coming soon)">
              <input className="lp-input" type="email" placeholder="you@school.edu" aria-label="Email address" disabled />
              <button type="submit" className="lp-btn lp-btn-primary" disabled>
                Coming soon
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      <CtaBand title="Put these ideas into practice" text="Try GradeAnt on your next assignment and see the difference in an afternoon." />
    </LandingPage>
  )
}
