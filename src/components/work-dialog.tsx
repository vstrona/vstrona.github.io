import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Maximize2, X } from 'lucide-react'
import type { Work } from '@/data/works'
import type { ViewerHandle } from '@/components/viewer'

export type WorkDialogHandle = { open: (work: Work, trigger: HTMLElement) => void }

function enterFullscreen(v: HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitRequestFullscreen?: () => void }) {
  if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.())
  else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen()
  else v.webkitEnterFullscreen?.() // iPhone
}

// Описание: абзацы, подзаголовки "## " и списки "- "
function Description({ text }: { text: string }) {
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) out.push(<ul key={out.length}>{list.map(li => <li key={li}>{li}</li>)}</ul>)
    list = []
  }

  text.split(/\n\s*\n/).forEach(raw => {
    const block = raw.trim()

    if (!block) return
    if (block.startsWith('- ')) {
      list.push(...block.split('\n').map(l => l.replace(/^-\s*/, '')))

      return
    }

    flush()
    if (block.startsWith('## ')) out.push(<h3 key={out.length}>{block.slice(3)}</h3>)
    else out.push(<p key={out.length}>{block}</p>)
  })
  flush()

  return <div className='work-desc'>{out}</div>
}

export const WorkDialog = forwardRef<WorkDialogHandle, { viewer: React.RefObject<ViewerHandle | null> }>(function WorkDialog({ viewer }, ref) {
  const dlgRef = useRef<HTMLDialogElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const [work, setWork] = useState<Work | null>(null)
  const [vertical, setVertical] = useState(false)
  const [closing, setClosing] = useState(false)
  const [ends, setEnds] = useState({ start: true, end: false })

  useImperativeHandle(ref, () => ({
    open(w, t) {
      trigger.current = t
      setWork(w)
      setVertical(false)
      document.documentElement.classList.add('is-locked')
      dlgRef.current?.showModal()
      dlgRef.current?.scrollTo(0, 0)
    }
  }))

  // Вертикальное видео узнаём по обложке, ещё до загрузки самого ролика
  useEffect(() => {
    if (!work?.poster) return

    const probe = new Image()

    probe.onload = () => setVertical(probe.naturalHeight > probe.naturalWidth)
    probe.src = work.poster
  }, [work])

  useEffect(() => {
    const g = galleryRef.current

    if (!g) return

    g.scrollLeft = 0

    const update = () => setEnds({ start: g.scrollLeft <= 2, end: g.scrollLeft >= g.scrollWidth - g.clientWidth - 2 })

    update()
    g.addEventListener('scroll', update, { passive: true })

    return () => g.removeEventListener('scroll', update)
  }, [work])

  const close = () => {
    const dlg = dlgRef.current

    if (!dlg?.open || closing) return

    videoRef.current?.pause()
    setClosing(true)
    setTimeout(
      () => {
        dlg.close()
        setClosing(false)
      },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260
    )
  }

  const onClose = () => {
    document.documentElement.classList.remove('is-locked')
    setWork(null)
    trigger.current?.focus({ preventScroll: true })
  }

  const scrollGallery = (dir: number) => {
    const g = galleryRef.current
    const item = g?.firstElementChild as HTMLElement | null

    if (!g || !item) return

    g.scrollBy({ left: dir * (item.offsetWidth + 12), behavior: 'smooth' })
  }

  const rows = work
    ? ([
        ['Тип', work.type],
        ['Сделано на', work.stack.join(', ')],
        ['Год', work.year]
      ].filter(r => r[1]) as [string, string | number][])
    : []

  return (
    <dialog
      ref={dlgRef}
      aria-labelledby='work-title'
      className={'work-dialog' + (closing ? ' is-closing' : '')}
      onCancel={e => {
        e.preventDefault()
        close()
      }}
      onClose={onClose}
      onKeyDown={e => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        close()
      }}
      onClick={e => e.target === dlgRef.current && close()}
    >
      {work && (
        <article className='work-dialog__panel'>
          <header className='flex items-start justify-between gap-6'>
            <div>
              <h2 id='work-title' className='m-0 text-head font-light tracking-[-0.035em] text-ink'>
                {work.title}
              </h2>
              <p className='m-0 mt-3 text-body text-muted'>{work.short}</p>
            </div>
            <button type='button' className='icon-square shrink-0' aria-label='Закрыть' onClick={close}>
              <X className='size-5' strokeWidth={1.6} aria-hidden />
            </button>
          </header>

          {work.video && (
            <div className={'relative mt-8 bg-black ' + (vertical ? 'flex justify-center' : '')}>
              <video
                ref={videoRef}
                key={work.video}
                src={work.video}
                poster={work.poster}
                controls
                playsInline
                preload='none'
                onLoadedMetadata={e => setVertical(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
                className={vertical ? 'aspect-[9/16] h-[min(70vh,640px)] w-auto' : 'aspect-video w-full'}
              />
              <button
                type='button'
                className='icon-square absolute top-4 right-4'
                aria-label='Видео на весь экран'
                onClick={() => videoRef.current && enterFullscreen(videoRef.current)}
              >
                <Maximize2 className='size-5' strokeWidth={1.6} aria-hidden />
              </button>
            </div>
          )}

          {work.images.length > 0 && (
            <div className='mt-3'>
              <div ref={galleryRef} className='work-gallery' tabIndex={0} aria-label='Скриншоты'>
                {work.images.map((shot, n) => (
                  <button
                    key={shot.src}
                    type='button'
                    className='work-shot'
                    style={{ aspectRatio: `${shot.w} / ${shot.h}` }}
                    aria-label={`Открыть скриншот ${n + 1} на весь экран`}
                    onClick={() => viewer.current?.open(work.images, n, work.title)}
                  >
                    <img src={shot.src} alt={`${work.title}, скриншот ${n + 1}`} width={shot.w} height={shot.h} loading={n > 2 ? 'lazy' : 'eager'} decoding='async' />
                  </button>
                ))}
              </div>
              {work.images.length > 1 && (
                <div className='mt-3 flex justify-end gap-2'>
                  <button type='button' className='icon-square' aria-label='Предыдущие скриншоты' disabled={ends.start} onClick={() => scrollGallery(-1)}>
                    <ArrowLeft className='size-5' strokeWidth={1.6} aria-hidden />
                  </button>
                  <button type='button' className='icon-square' aria-label='Следующие скриншоты' disabled={ends.end} onClick={() => scrollGallery(1)}>
                    <ArrowRight className='size-5' strokeWidth={1.6} aria-hidden />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className='mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16'>
            <Description text={work.description} />

            <aside className='flex flex-col gap-8 self-start lg:sticky lg:top-0'>
              <dl className='m-0 grid gap-5'>
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className='text-small text-muted'>{k}</dt>
                    <dd className='m-0 mt-1 text-body text-ink'>{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className='flex flex-col items-start gap-2'>
                {work.url && (
                  <a className='btn-solid' href={work.url} target='_blank' rel='noopener'>
                    Открыть сайт
                    <ArrowUpRight className='size-4' strokeWidth={1.8} aria-hidden />
                  </a>
                )}
                {work.links.map(l => (
                  <a key={l.url} className='btn-tone' href={l.url} target='_blank' rel='noopener'>
                    {l.label}
                    <ArrowUpRight className='size-4' strokeWidth={1.8} aria-hidden />
                  </a>
                ))}
                {!work.url && <p className='m-0 text-small text-muted'>Демонстрационный проект, живого сайта нет.</p>}
              </div>
            </aside>
          </div>
        </article>
      )}
    </dialog>
  )
})
