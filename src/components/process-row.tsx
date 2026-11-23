import { useEffect, useRef, useState } from 'react'

// Видео играет без звука по кругу, только пока его видно
function LoopVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current

    if (!video) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !still) video.play().catch(() => {})
      else video.pause()
    })

    io.observe(video)

    return () => io.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      preload='none'
      className='size-full object-cover object-top'
    />
  )
}
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'

// Как идёт работа, слева направо. Картинки: настоящие экраны из моих проектов,
// каждый показывает, как этот этап выглядит в готовой работе.
type Moment = { caption: string; text: string; img: string; video?: string; note: string; gap: number }

const MOMENTS: Moment[] = [
  {
    caption: 'Сначала задача',
    text: 'Вы пишете в Telegram, что нужно. Я задаю вопросы, собираю структуру и пишу тексты, которые продают.',
    img: 'assets/works/olha/11.webp',
    note: 'Ольха: цены с понятной выгодой',
    gap: 112
  },
  {
    caption: 'Потом дизайн',
    text: 'Рисую макет под ваш бизнес: цвета, шрифты, анимации. Сразу под телефон, с него приходит большинство.',
    img: 'assets/works/sushiko/09.webp',
    note: 'SUSHIKO: меню на телефоне',
    gap: 80
  },
  {
    caption: 'Разработка',
    text: 'Верстаю и программирую без конструкторов: каталог, корзина, расписание, личный кабинет. Сайт получается быстрым.',
    img: 'assets/works/sevmsubot/04.webp',
    note: 'Расписание МГУ: статистика недели',
    gap: 140
  },
  {
    caption: 'Бот и админка',
    text: 'Делаю Telegram бота или панель, где вы сами меняете цены и принимаете заказы. Программист для этого не нужен.',
    img: 'assets/works/sushiko/11.webp',
    note: 'SUSHIKO: заказы в админке',
    gap: 96
  },
  {
    caption: 'Запуск',
    text: 'Подключаю домен, сервер и HTTPS, размечаю сайт для поиска. Если нужно, сайт ставится на телефон как приложение.',
    img: 'assets/works/sevmsubot/14.webp',
    note: 'Расписание МГУ: установка на главный экран',
    gap: 128
  },
  {
    caption: 'И после запуска',
    text: 'Вношу правки, помогаю с сайтом дальше и монтирую видеообзор, который можно показать клиентам.',
    img: 'assets/works/sevmsubot/video-poster.jpg',
    video: 'assets/works/sevmsubot/video.mp4',
    note: 'Расписание МГУ: видеообзор',
    gap: 88
  }
]

export function ProcessRow() {
  const rowRef = useRef<HTMLOListElement>(null)
  const [progress, setProgress] = useState(0)
  const [ends, setEnds] = useState({ start: true, end: false })
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)

  useEffect(() => {
    const row = rowRef.current

    if (!row) return

    const update = () => {
      const max = row.scrollWidth - row.clientWidth

      setProgress(max > 0 ? row.scrollLeft / max : 1)
      setEnds({ start: row.scrollLeft <= 2, end: row.scrollLeft >= max - 2 })
    }

    update()
    row.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)

    return () => {
      row.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const step = (dir: number) => {
    const row = rowRef.current
    const first = row?.firstElementChild as HTMLElement | null

    if (!row || !first) return

    const gap = parseFloat(getComputedStyle(row).columnGap) || 0

    row.scrollBy({ left: dir * (first.offsetWidth + gap), behavior: 'smooth' })
  }

  // Мышью ряд можно тянуть, как пальцем
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !rowRef.current) return

    drag.current = { x: e.clientX, left: rowRef.current.scrollLeft, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const row = rowRef.current

    if (!drag.current || !row) return

    const dx = e.clientX - drag.current.x

    if (Math.abs(dx) > 4) {
      drag.current.moved = true
      row.style.scrollSnapType = 'none'
      row.scrollLeft = drag.current.left - dx
    }
  }

  const endDrag = () => {
    if (rowRef.current) rowRef.current.style.scrollSnapType = ''
    drag.current = null
  }

  return (
    <section id='process' aria-labelledby='process-title' className='pt-32 sm:pt-48'>
      <div className='px-gutter'>
        <div className='flex items-center justify-between gap-6'>
          <Reveal>
            <h2 id='process-title' className='m-0 text-lead font-normal text-ink'>
              Как я работаю
            </h2>
          </Reveal>
          <div className='hidden gap-2 sm:flex'>
            <button type='button' className='icon-square' aria-label='Назад' onClick={() => step(-1)} disabled={ends.start}>
              <ArrowLeft className='size-5' strokeWidth={1.6} aria-hidden />
            </button>
            <button type='button' className='icon-square' aria-label='Дальше' onClick={() => step(1)} disabled={ends.end}>
              <ArrowRight className='size-5' strokeWidth={1.6} aria-hidden />
            </button>
          </div>
        </div>

        <div className='mt-6 h-1.5 bg-surface-2' aria-hidden>
          <div className='h-full bg-ink transition-[width] duration-200 ease-out' style={{ width: `${Math.max(8, progress * 100)}%` }} />
        </div>
      </div>

      <ol
        ref={rowRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className='m-0 mt-10 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto px-gutter pb-4 [scroll-padding-inline:var(--gutter)] [scrollbar-width:none] sm:gap-8 [&::-webkit-scrollbar]:hidden'
      >
        {MOMENTS.map((moment, i) => (
          <Reveal as='li' key={moment.caption} delay={Math.min(i, 3) * 0.08} className='w-[72vw] shrink-0 snap-start sm:w-[300px]'>
            <h3 className='m-0 text-body font-medium text-ink'>{moment.caption}</h3>
            <p className='m-0 mt-2 text-body text-ink'>{moment.text}</p>
            <figure className='m-0' style={{ marginTop: `clamp(32px, ${moment.gap / 14.4}vw, ${moment.gap}px)` }}>
              <div className='aspect-[4/5] overflow-hidden bg-surface'>
                {moment.video ? (
                  <LoopVideo src={moment.video} poster={moment.img} label={moment.note} />
                ) : (
                  <img src={moment.img} alt={moment.note} loading='lazy' draggable={false} width={720} height={900} className='size-full object-cover object-top select-none' />
                )}
              </div>
              <figcaption className='mt-3 text-small text-muted'>{moment.note}</figcaption>
            </figure>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}
