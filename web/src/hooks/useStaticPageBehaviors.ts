import { useEffect, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'

export interface StaticBehaviorOptions {
  /** Pixels to leave above the target when smooth-scrolling to an in-page #anchor. */
  anchorOffset?: number
  /** `.slides` / `.dot` slideshow with prev/next ([data-slide-step]) and dots ([data-slide-to]). */
  slideshow?: {
    intervalMs?: number
    /** CSS animation restarted on #slideProgressBar at each slide. */
    progressAnimation?: string
    keyboard?: boolean
    swipe?: boolean
  }
  /** Adds `animate-in` once to elements matching this selector as they scroll into view. */
  revealSelector?: string
  /** Fades/slides these elements in as they scroll into view (inline styles, legal pages). */
  fadeInSelector?: string
  /** Adds `active` to <section>s as they scroll into view (home page). */
  activateSections?: boolean
  /** Updates #toc-toggle's label when it opens/closes #toc-content. */
  tocLabels?: { open: string; closed: string }
}

/**
 * The small DOM enhancements the static marketing/legal pages had as inline
 * scripts, applied to their converted markup inside `root`:
 * mobile menu, smooth #anchor scrolling, back-to-top, table of contents, FAQ
 * accordion, blog category tabs, copy-email tooltips, [data-nav-to] buttons,
 * preloader fade, scroll reveals and the slideshow.
 */
export function useStaticPageBehaviors(root: RefObject<HTMLElement | null>, opts: StaticBehaviorOptions = {}) {
  const navigate = useNavigate()

  useEffect(() => {
    const el = root.current
    if (!el) return
    const cleanups: (() => void)[] = []
    const on = <K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void) => {
      target.addEventListener(type, fn)
      cleanups.push(() => target.removeEventListener(type, fn))
    }

    // ---- Slideshow ----
    const slides = Array.from(el.querySelectorAll<HTMLElement>('.slides'))
    const dots = Array.from(el.querySelectorAll<HTMLElement>('.dot'))
    let slideIndex = 1
    let slideTimer: number | undefined
    const showSlide = (n: number) => {
      if (slides.length === 0) return
      slideIndex = n > slides.length ? 1 : n < 1 ? slides.length : n
      slides.forEach((s, i) => (s.style.display = i === slideIndex - 1 ? 'block' : 'none'))
      dots.forEach((d, i) => d.classList.toggle('active', i === slideIndex - 1))
      const bar = el.querySelector<HTMLElement>('#slideProgressBar')
      if (bar && opts.slideshow?.progressAnimation) {
        bar.style.animation = 'none'
        void bar.offsetHeight // restart the animation
        bar.style.animation = opts.slideshow.progressAnimation
      }
    }
    const restartTimer = () => {
      window.clearInterval(slideTimer)
      slideTimer = window.setInterval(() => showSlide(slideIndex + 1), opts.slideshow?.intervalMs ?? 5000)
    }
    const goSlide = (n: number) => {
      showSlide(n)
      restartTimer()
    }
    if (opts.slideshow && slides.length > 0) {
      showSlide(1)
      restartTimer()
      cleanups.push(() => window.clearInterval(slideTimer))
      if (opts.slideshow.keyboard) {
        on(window, 'keydown', (e) => {
          if (e.key === 'ArrowLeft') goSlide(slideIndex - 1)
          else if (e.key === 'ArrowRight') goSlide(slideIndex + 1)
        })
      }
      const container = el.querySelector<HTMLElement>('.slideshow-container')
      if (opts.slideshow.swipe && container) {
        let startX = 0
        const start = (e: TouchEvent) => (startX = e.changedTouches[0].screenX)
        const end = (e: TouchEvent) => {
          const dx = e.changedTouches[0].screenX - startX
          if (dx < -50) goSlide(slideIndex + 1)
          else if (dx > 50) goSlide(slideIndex - 1)
        }
        container.addEventListener('touchstart', start)
        container.addEventListener('touchend', end)
        cleanups.push(() => {
          container.removeEventListener('touchstart', start)
          container.removeEventListener('touchend', end)
        })
      }
    }

    // ---- Delegated clicks ----
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const navLinks = el.querySelector('#navLinks')

      if (target.closest('#mobileMenuBtn')) {
        navLinks?.classList.toggle('active')
        return
      }

      const step = target.closest<HTMLElement>('[data-slide-step]')
      if (step) return goSlide(slideIndex + Number(step.dataset.slideStep))
      const to = target.closest<HTMLElement>('[data-slide-to]')
      if (to) return goSlide(Number(to.dataset.slideTo))

      const navTo = target.closest<HTMLElement>('[data-nav-to]')
      if (navTo?.dataset.navTo) {
        navigate(navTo.dataset.navTo)
        return
      }

      const toc = target.closest<HTMLElement>('#toc-toggle')
      if (toc) {
        const content = el.querySelector('#toc-content')
        const open = !!content?.classList.toggle('show')
        if (opts.tocLabels) toc.innerHTML = open ? opts.tocLabels.open : opts.tocLabels.closed
        return
      }

      const faq = target.closest<HTMLElement>('.faq-question')
      if (faq?.parentElement) {
        const open = faq.parentElement.classList.toggle('active')
        const sign = faq.querySelector('.faq-toggle')
        if (sign) sign.textContent = open ? '-' : '+'
        return
      }

      const tab = target.closest<HTMLElement>('.category-tab')
      if (tab) {
        el.querySelectorAll('.category-tab').forEach((t) => t.classList.toggle('active', t === tab))
        return
      }

      const tooltip = target.closest<HTMLElement>('.tooltip')
      if (tooltip) {
        const label = tooltip.querySelector('.tooltip-text')
        const text = (tooltip.textContent ?? '').split('\n')[0].replace(label?.textContent ?? '', '').trim()
        void navigator.clipboard?.writeText(text).then(() => {
          if (!label) return
          const original = label.textContent
          label.textContent = 'Copied!'
          window.setTimeout(() => (label.textContent = original), 2000)
        })
        return
      }

      const backToTop = target.closest('#backToTop')
      if (backToTop) {
        e.preventDefault()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]')
      if (anchor) {
        e.preventDefault()
        const id = anchor.getAttribute('href')!.slice(1)
        const dest = id ? document.getElementById(id) : null
        if (dest) {
          window.scrollTo({ top: dest.getBoundingClientRect().top + window.scrollY - (opts.anchorOffset ?? 80), behavior: 'smooth' })
          navLinks?.classList.remove('active')
        }
      }
    }
    el.addEventListener('click', onClick)
    cleanups.push(() => el.removeEventListener('click', onClick))

    // Forms on these pages have no backend; keep them from reloading the page.
    const onSubmit = (e: Event) => e.preventDefault()
    el.addEventListener('submit', onSubmit)
    cleanups.push(() => el.removeEventListener('submit', onSubmit))

    // ---- Scroll-driven bits ----
    const backToTop = el.querySelector('#backToTop')
    const navLinks = el.querySelector('#navLinks')
    const sections = opts.activateSections ? Array.from(el.querySelectorAll<HTMLElement>('section')) : []
    const onScroll = () => {
      backToTop?.classList.toggle('visible', window.scrollY > 300)
      const y = window.scrollY
      const h = window.innerHeight
      sections.forEach((s) => {
        if (y > s.offsetTop - h + 100 && y < s.offsetTop + s.offsetHeight) s.classList.add('active')
      })
    }
    if (backToTop || sections.length) {
      on(window, 'scroll', onScroll)
      onScroll()
    }
    on(window, 'resize', () => {
      if (window.innerWidth > 768) navLinks?.classList.remove('active')
    })

    if (opts.revealSelector || opts.fadeInSelector) {
      const fadeIns = opts.fadeInSelector ? Array.from(el.querySelectorAll<HTMLElement>(opts.fadeInSelector)) : []
      fadeIns.forEach((s) => {
        s.style.opacity = '0'
        s.style.transform = 'translateY(20px)'
        s.style.transition = 'opacity 0.5s ease, transform 0.5s ease'
      })
      const observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const t = entry.target as HTMLElement
            if (fadeIns.includes(t)) {
              t.style.opacity = '1'
              t.style.transform = 'translateY(0)'
            } else {
              t.classList.add('animate-in')
              observer.unobserve(t)
            }
          }),
        { threshold: 0.1 },
      )
      if (opts.revealSelector) el.querySelectorAll(opts.revealSelector).forEach((n) => observer.observe(n))
      fadeIns.forEach((n) => observer.observe(n))
      cleanups.push(() => observer.disconnect())
    }

    // ---- Preloader ----
    const preloader = el.querySelector<HTMLElement>('#preloader')
    if (preloader) {
      preloader.style.opacity = '0'
      const t = window.setTimeout(() => (preloader.style.display = 'none'), 500)
      cleanups.push(() => window.clearTimeout(t))
    }

    return () => cleanups.forEach((fn) => fn())
    // Options are static per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
