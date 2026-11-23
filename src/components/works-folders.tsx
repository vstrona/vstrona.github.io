import { useEffect, useRef, useState } from 'react'
import GlassFolder, { type FolderFile } from '@/components/ui/glass-folder-cards'

// Работы берутся из public/js/works.js (window.WORKS), окно проекта и просмотр скриншотов
// живут в public/js/script.js и доступны через window.portfolio.
type Shot = { src: string; w: number; h: number }
export type Work = {
  id: string
  title: string
  short?: string
  year?: string | number
  type?: string
  preview?: string
  poster?: string
  video?: string
  images?: Shot[]
}

declare global {
  interface Window {
    WORKS?: Work[]
    portfolio?: {
      openWork: (index: number, trigger?: HTMLElement | null) => void
      openShot: (index: number, shot: number) => void
    }
  }
}

// В папке три скриншота из разных мест галереи и, если есть, видеообзор спереди
function folderFiles(work: Work) {
  const shots = work.images ?? []
  const picked = [...new Set([0, Math.floor(shots.length / 2), shots.length - 1])].filter(n => n >= 0 && n < shots.length)
  const files: FolderFile[] = []
  const actions: Array<{ kind: 'shot'; n: number } | { kind: 'video' }> = []

  picked.forEach(n => {
    files.push({ name: `Экран ${n + 1}`, meta: `из ${shots.length}`, image: shots[n].src })
    actions.push({ kind: 'shot', n })
  })

  if (work.video) {
    files.push({ name: 'Видеообзор', meta: 'смотреть', image: work.poster ?? work.preview })
    actions.push({ kind: 'video' })
  }

  return { files, actions }
}

// Ширина папки подстраивается под колонку: три в ряд на компьютере, две на планшете, одна на телефоне
function useLayout() {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ cols: 3, width: 340 })

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const measure = () => {
      const w = el.clientWidth
      const cols = w >= 1060 ? 3 : w >= 680 ? 2 : 1
      const gap = 40

      setLayout({ cols, width: Math.min(380, Math.floor((w - gap * (cols - 1)) / cols)) })
    }

    const ro = new ResizeObserver(measure)

    ro.observe(el)
    measure()

    return () => ro.disconnect()
  }, [])

  return { ref, ...layout }
}

export default function WorksFolders({ works }: { works: Work[] }) {
  const { ref, cols, width } = useLayout()

  return (
    <div
      ref={ref}
      className='grid justify-center gap-x-10 gap-y-16'
      style={{ gridTemplateColumns: `repeat(${cols}, ${width}px)` }}
    >
      {works.map((work, i) => {
        const { files, actions } = folderFiles(work)
        const meta = [work.type, work.year].filter(Boolean).join(' · ')

        return (
          <figure key={work.id} className='m-0'>
            <GlassFolder
              label={work.title}
              meta={meta || `${work.images?.length ?? 0} скриншотов`}
              image={work.preview}
              files={files}
              width={width}
              appearDelay={(i % cols) * 140}
              action='open'
              actionLabel={`Открыть проект «${work.title}»: видео, скриншоты и описание`}
              onAction={trigger => window.portfolio?.openWork(i, trigger)}
              onFileSelect={(_, index) => {
                const act = actions[index]

                if (!act) return
                if (act.kind === 'shot') window.portfolio?.openShot(i, act.n)
                else window.portfolio?.openWork(i, document.activeElement as HTMLElement | null)
              }}
            />
            {work.short && <figcaption className='body-6 muted mt-3 max-w-[34ch]'>{work.short}</figcaption>}
          </figure>
        )
      })}
    </div>
  )
}
