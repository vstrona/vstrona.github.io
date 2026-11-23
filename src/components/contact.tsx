import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { CONTACTS } from '@/data/site'
import { copyText } from '@/lib/utils'

/**
 * Одно поле. Текст задачи копируется, и открывается чат со мной в Telegram: остаётся вставить.
 * Серверной формы нет, поэтому личные данные нигде не хранятся.
 */
export function Contact() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'sent' | 'empty'>('idle')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()

    const value = text.trim()

    if (!value) {
      setStatus('empty')
      inputRef.current?.focus()

      return
    }

    copyText(value)
    window.open(CONTACTS.telegram.url, '_blank', 'noopener')
    setStatus('sent')
  }

  const copyEmail = () => {
    copyText(CONTACTS.email.value).then(ok => {
      if (!ok) return
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    })
  }

  const mailto = `mailto:${CONTACTS.email.value}?subject=${encodeURIComponent('Задача для сайта')}&body=${encodeURIComponent(text)}`

  return (
    <section id='contacts' aria-labelledby='contact-title' className='px-gutter pt-32 sm:pt-48'>
      <div className='grid gap-16 lg:grid-cols-12 lg:gap-6'>
        <div className='lg:col-span-7'>
          <Reveal>
            <h2 id='contact-title' className='m-0 text-head leading-[1.02] font-light tracking-[-0.035em]'>
              <span className='block text-ink'>Нужен сайт или бот?</span>
              <span className='block text-muted'>Напишите задачу.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <form onSubmit={submit} className='relative mt-12 max-w-[640px]'>
              <label htmlFor='task' className='sr-only'>
                Ваша задача
              </label>
              <input
                ref={inputRef}
                id='task'
                type='text'
                autoComplete='off'
                value={text}
                onChange={e => {
                  setText(e.target.value)
                  if (status === 'empty') setStatus('idle')
                }}
                placeholder='Например: сайт для кофейни'
                className='contact-field'
              />
              <button type='submit' aria-label='Отправить в Telegram' className='contact-submit'>
                <ArrowRight className='size-5' strokeWidth={1.8} aria-hidden />
              </button>
            </form>
            <p className='m-0 mt-4 max-w-[640px] text-body text-muted' role='status' aria-live='polite'>
              {status === 'sent'
                ? 'Текст скопирован. Вставьте его в открывшийся чат, и я отвечу.'
                : status === 'empty'
                  ? 'Напишите хотя бы пару слов о задаче.'
                  : (
                      <>
                        Откроется чат со мной в Telegram, текст уже будет скопирован. Удобнее почтой?{' '}
                        <a href={mailto} className='link-quiet text-ink'>
                          Отправить письмом
                        </a>
                      </>
                    )}
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.16} className='lg:col-span-4 lg:col-start-9 lg:self-end'>
          <dl className='m-0 grid gap-8'>
            <div>
              <dt className='text-small text-muted'>Telegram, отвечаю быстрее всего</dt>
              <dd className='m-0 mt-1 text-lead'>
                <a href={CONTACTS.telegram.url} target='_blank' rel='noopener' className='link-quiet text-ink'>
                  {CONTACTS.telegram.value}
                </a>
              </dd>
            </div>
            <div>
              <dt className='text-small text-muted'>Почта</dt>
              <dd className='m-0 mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-lead'>
                <a href={`mailto:${CONTACTS.email.value}`} className='link-quiet text-ink'>
                  {CONTACTS.email.value}
                </a>
                <button type='button' onClick={copyEmail} className='copy-btn' aria-label='Скопировать почту'>
                  {copied ? <Check className='size-4' strokeWidth={1.8} aria-hidden /> : <Copy className='size-4' strokeWidth={1.8} aria-hidden />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </dd>
            </div>
            <div>
              <dt className='text-small text-muted'>Kwork, если удобнее через биржу</dt>
              <dd className='m-0 mt-1 text-lead'>
                <a href={CONTACTS.kwork.url} target='_blank' rel='noopener' className='link-quiet text-ink'>
                  {CONTACTS.kwork.value}
                </a>
              </dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
