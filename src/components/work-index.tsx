import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import type { Work } from '@/data/works'

function meta(w: Work) {
  return [w.type, w.year].filter(Boolean).join(', ')
}

/**
 * Работы: крупные названия слева, справа липкая рамка с экраном телефона активной работы.
 * Экран медленно прокручивается сверху вниз, как будто листают сайт. Нажатие открывает окно проекта.
 */
export function WorkIndex({ works, onOpen }: { works: Work[]; onOpen: (index: number, trigger: HTMLElement) => void }) {
  const [active, setActive] = useState(0)

  return (
    <section id='works' aria-labelledby='works-title' className='px-gutter pt-32 sm:pt-48'>
      <Reveal>
        <h2 id='works-title' className='m-0 text-lead font-normal text-ink'>
          Мои работы
        </h2>
      </Reveal>
      <Reveal delay={0.08}>
        <p className='m-0 mt-3 max-w-[36rem] text-body text-muted'>Нажмите на работу: откроется видео, скриншоты и рассказ, что и как сделано.</p>
      </Reveal>

      <div className='mt-12 grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6'>
        <ol className='m-0 list-none p-0 md:col-span-8'>
          {works.map((w, i) => (
            <Reveal as='li' key={w.id} delay={Math.min(i, 4) * 0.06} className='mb-10 md:mb-0'>
              <button
                type='button'
                aria-haspopup='dialog'
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={e => onOpen(i, e.currentTarget)}
                className='group block w-full cursor-pointer border-0 bg-transparent p-0 text-left md:py-2.5'
              >
                {/* На телефоне перед каждым названием своя обложка */}
                <span className='mb-4 block aspect-[16/10] overflow-hidden bg-surface md:hidden'>
                  <img src={w.preview} alt='' loading='lazy' width={1300} height={900} className='size-full object-cover' />
                </span>
                <span className='flex flex-col gap-1 md:flex-row md:items-baseline md:gap-6'>
                  <span
                    className={
                      'text-head font-light tracking-[-0.035em] transition-colors duration-200 ' +
                      (active === i ? 'text-ink' : 'text-ink md:text-muted')
                    }
                  >
                    {w.name}
                  </span>
                  <span className='flex items-center gap-2 text-small text-muted'>
                    {meta(w)}
                    <ArrowUpRight
                      className={'size-4 transition-[opacity,translate] duration-300 ' + (active === i ? 'opacity-100' : 'opacity-100 md:opacity-0')}
                      strokeWidth={1.6}
                      aria-hidden
                    />
                  </span>
                </span>
              </button>
            </Reveal>
          ))}
        </ol>

        <div className='hidden md:col-span-4 md:block'>
          <div className='sticky top-[15vh]'>
            <div className='relative aspect-[4/5] overflow-hidden bg-surface'>
              {works.map((w, i) => (
                <img
                  key={w.id}
                  src={w.phone.src}
                  alt={i === active ? `${w.title}: экран на телефоне` : ''}
                  aria-hidden={i !== active}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  width={w.phone.w}
                  height={w.phone.h}
                  className='phone-drift absolute inset-x-0 top-0 w-full transition-opacity duration-200'
                  style={{ opacity: i === active ? 1 : 0 }}
                />
              ))}
            </div>
            <p className='m-0 mt-4 text-small text-muted'>{works[active]?.short}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
