import { useRef } from 'react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import SyntraHero from '@/components/ui/syntra-hero'
import { ProcessRow } from '@/components/process-row'
import { WorkIndex } from '@/components/work-index'
import { WorkDialog, type WorkDialogHandle } from '@/components/work-dialog'
import { Viewer, type ViewerHandle } from '@/components/viewer'
import { Contact } from '@/components/contact'
import { WORKS } from '@/data/works'
import { CONTACTS } from '@/data/site'

export default function App() {
  const dialog = useRef<WorkDialogHandle>(null)
  const viewer = useRef<ViewerHandle>(null)

  return (
    <MotionConfig reducedMotion='user'>
      <LazyMotion features={domAnimation}>
        <a href='#works' className='sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-ground'>
          Перейти к работам
        </a>

        <SyntraHero
          name='Виктор Стронов'
          lead='Делаю сайты, интернет-магазины и Telegram ботов под ключ. Один человек на всех этапах: от задачи и дизайна до сервера и запуска.'
          action={{ label: 'Написать в Telegram', href: CONTACTS.telegram.url }}
          links={[
            { label: 'Работы', href: '#works' },
            { label: 'Как я работаю', href: '#process', desktopOnly: true },
            { label: 'Контакты', href: '#contacts' },
            { label: 'Telegram', href: CONTACTS.telegram.url, external: true }
          ]}
        />

        <main>
          <WorkIndex works={WORKS} onOpen={(i, trigger) => dialog.current?.open(WORKS[i], trigger)} />
          <ProcessRow />
          <Contact />
        </main>

        <footer className='mt-32 grid gap-2 px-gutter pb-6 text-small sm:grid-cols-[1fr_auto_1fr] sm:items-baseline sm:gap-6'>
          <p className='m-0 text-muted'>Виктор Стронов, сайты под ключ</p>
          <ul className='m-0 flex list-none flex-wrap gap-6 p-0'>
            <li>
              <a href={CONTACTS.telegram.url} target='_blank' rel='noopener' className='link-quiet text-ink'>
                Telegram
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACTS.email.value}`} className='link-quiet text-ink'>
                Почта
              </a>
            </li>
            <li>
              <a href={CONTACTS.kwork.url} target='_blank' rel='noopener' className='link-quiet text-ink'>
                Kwork
              </a>
            </li>
          </ul>
          <p className='m-0 text-muted sm:text-right'>© {new Date().getFullYear()}</p>
        </footer>

        <WorkDialog ref={dialog} viewer={viewer} />
        <Viewer ref={viewer} />
      </LazyMotion>
    </MotionConfig>
  )
}
