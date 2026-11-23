import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { Shot } from '@/data/works'

/*
  Просмотр скриншотов «как в Telegram», третий слой поверх окна проекта:
  - листать: свайп, стрелки на экране, клавиши ← →
  - приближать: колесо мыши, щипок двумя пальцами, двойной клик или тап, кнопки + и −
  - двигать приближенное фото: перетаскивание мышью или пальцем
  - закрыть: крестик, Esc, клик по пустому месту, свайп вниз
*/

export type ViewerHandle = { open: (list: Shot[], index: number, title: string) => void }

const MIN = 1
const MAX = 5
const DOUBLE = 2.5
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

type Gesture =
  | { type: 'pending' | 'pan' | 'swipe' | 'dismiss'; x: number; y: number; tx: number; ty: number; moved: boolean }
  | { type: 'pinch'; dist: number; s: number; mid: { x: number; y: number }; tx: number; ty: number; moved?: boolean }

export const Viewer = forwardRef<ViewerHandle>(function Viewer(_, ref) {
  const dlgRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [items, setItems] = useState<Shot[]>([])
  const [index, setIndex] = useState(0)
  const [title, setTitle] = useState('')
  const [closing, setClosing] = useState(false)
  const state = useRef({ s: 1, tx: 0, ty: 0, busy: false, items: [] as Shot[], index: 0 })

  useImperativeHandle(ref, () => ({
    open(list, i, name) {
      state.current.items = list
      state.current.index = i
      setItems(list)
      setIndex(i)
      setTitle(name)
      reset()
      dlgRef.current?.showModal()
    }
  }))

  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function apply(animate = false) {
    const img = imgRef.current
    const st = state.current

    if (!img) return

    img.style.transition = animate && !reduce() ? `transform 300ms ${EASE}` : 'none'
    img.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.s})`
    stageRef.current?.classList.toggle('is-zoomed', st.s > 1.01)
  }

  function clampPan() {
    const img = imgRef.current
    const stage = stageRef.current
    const st = state.current

    if (!img || !stage) return

    const mx = Math.max(0, (img.offsetWidth * st.s - stage.clientWidth) / 2)
    const my = Math.max(0, (img.offsetHeight * st.s - stage.clientHeight) / 2)

    st.tx = Math.min(mx, Math.max(-mx, st.tx))
    st.ty = Math.min(my, Math.max(-my, st.ty))
  }

  function local(x: number, y: number) {
    const r = stageRef.current!.getBoundingClientRect()

    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }
  }

  function zoomTo(next: number, px: number, py: number, animate: boolean) {
    const st = state.current

    next = Math.min(MAX, Math.max(MIN, next))
    st.tx = px - ((px - st.tx) * next) / st.s
    st.ty = py - ((py - st.ty) * next) / st.s
    st.s = next
    if (st.s <= 1.01) Object.assign(st, { s: 1, tx: 0, ty: 0 })
    clampPan()
    apply(animate)
  }

  function reset() {
    Object.assign(state.current, { s: 1, tx: 0, ty: 0 })
    apply(false)
  }

  function show(i: number, dir: number) {
    const st = state.current
    const img = imgRef.current

    if (st.busy || i < 0 || i >= st.items.length || !img) return

    const go = () => {
      st.index = i
      setIndex(i)
      reset()
      ;[i - 1, i + 1].forEach(n => {
        if (st.items[n]) new Image().src = st.items[n].src
      })
    }

    if (reduce() || !img.animate) {
      go()

      return
    }

    st.busy = true

    const out = img.animate([{ transform: img.style.transform || 'none', opacity: 1 }, { transform: `translateX(${-dir * 40}px)`, opacity: 0 }], {
      duration: 160,
      easing: EASE,
      fill: 'forwards'
    })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      go()
      out.cancel()
      img.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 300, easing: EASE })
      st.busy = false
    }

    out.onfinish = finish
    setTimeout(finish, 220) // страховка, если анимация не доиграет
  }

  function close() {
    const dlg = dlgRef.current

    if (!dlg?.open || closing) return

    setClosing(true)
    setTimeout(
      () => {
        dlg.close()
        setClosing(false)
        if (imgRef.current) imgRef.current.style.opacity = ''
      },
      reduce() ? 0 : 200
    )
  }

  // Жесты пальцем и мышью
  useEffect(() => {
    const stage = stageRef.current
    const img = imgRef.current

    if (!stage || !img) return

    const pointers = new Map<number, { x: number; y: number }>()
    let g: Gesture | null = null
    let lastTap = { t: 0, x: 0, y: 0, timer: 0 }
    const st = state.current

    const startGesture = () => {
      const pts = [...pointers.values()]

      if (pts.length >= 2) {
        const [a, b] = pts

        g = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), s: st.s, mid: local((a.x + b.x) / 2, (a.y + b.y) / 2), tx: st.tx, ty: st.ty }
      } else if (pts.length === 1) {
        g = { type: 'pending', x: pts[0].x, y: pts[0].y, tx: st.tx, ty: st.ty, moved: false }
      }
    }

    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      try {
        stage.setPointerCapture(e.pointerId)
      } catch {
        /* не критично */
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      startGesture()
    }

    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId) || !g) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      const pts = [...pointers.values()]

      if (g.type === 'pinch' && pts.length >= 2) {
        const [a, b] = pts
        const next = Math.min(MAX, Math.max(MIN * 0.8, (g.s * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist))
        const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2)

        st.s = next
        st.tx = mid.x - ((g.mid.x - g.tx) * next) / g.s
        st.ty = mid.y - ((g.mid.y - g.ty) * next) / g.s
        apply(false)

        return
      }

      if (g.type === 'pinch') return

      const dx = e.clientX - g.x
      const dy = e.clientY - g.y

      if (g.type === 'pending') {
        if (Math.hypot(dx, dy) < 8) return
        g.moved = true
        g.type = st.s > 1.01 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'dismiss'
      }

      if (g.type === 'pan') {
        st.tx = g.tx + dx
        st.ty = g.ty + dy
        clampPan()
        apply(false)
      } else if (g.type === 'swipe') {
        const edge = (st.index === 0 && dx > 0) || (st.index === st.items.length - 1 && dx < 0)

        st.tx = edge ? dx * 0.3 : dx
        apply(false)
      } else if (g.type === 'dismiss') {
        st.ty = Math.max(0, dy)
        apply(false)
        img.style.opacity = String(Math.max(0.3, 1 - st.ty / 400))
      }
    }

    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return

      const at = pointers.get(e.pointerId)!

      pointers.delete(e.pointerId)

      const gesture = g

      if (gesture?.type === 'pinch') {
        if (st.s < 1) Object.assign(st, { s: 1, tx: 0, ty: 0 })
        clampPan()
        apply(true)
        startGesture() // оставшийся палец продолжает двигать фото
        if (g && g.type !== 'pinch') {
          g.type = st.s > 1.01 ? 'pan' : 'pending'
          g.moved = true
        }

        return
      }

      g = null
      if (!gesture) return

      const dx = at.x - gesture.x
      const dy = at.y - gesture.y

      if (gesture.type === 'swipe') {
        const dir = dx < -60 ? 1 : dx > 60 ? -1 : 0

        if (dir && st.items[st.index + dir]) show(st.index + dir, dir)
        else {
          st.tx = 0
          apply(true)
        }

        return
      }

      if (gesture.type === 'dismiss') {
        if (dy > 120) {
          close()

          return
        }
        st.ty = 0
        img.style.opacity = ''
        apply(true)

        return
      }

      if (gesture.type === 'pan' || gesture.moved) return

      // Тап: двойной приближает или отдаляет, одиночный мимо фото закрывает
      const now = Date.now()
      const p = local(at.x, at.y)

      if (now - lastTap.t < 300 && Math.hypot(at.x - lastTap.x, at.y - lastTap.y) < 30) {
        clearTimeout(lastTap.timer)
        lastTap.t = 0
        if (st.s > 1.01) zoomTo(1, 0, 0, true)
        else zoomTo(DOUBLE, p.x, p.y, true)

        return
      }

      lastTap = { t: now, x: at.x, y: at.y, timer: 0 }
      if (e.target !== img && st.s <= 1.01) lastTap.timer = window.setTimeout(close, 300)
    }

    const wheel = (e: WheelEvent) => {
      e.preventDefault()

      const p = local(e.clientX, e.clientY)
      const k = e.ctrlKey ? 0.01 : 0.0025

      zoomTo(st.s * Math.exp(-e.deltaY * k), p.x, p.y, false)
    }

    const resize = () => {
      clampPan()
      apply(false)
    }

    stage.addEventListener('pointerdown', down)
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerup', up)
    stage.addEventListener('pointercancel', up)
    stage.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('resize', resize)

    return () => {
      stage.removeEventListener('pointerdown', down)
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerup', up)
      stage.removeEventListener('pointercancel', up)
      stage.removeEventListener('wheel', wheel)
      window.removeEventListener('resize', resize)
    }
    // обработчики читают состояние из ref, пересоздавать их не нужно
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const st = state.current

    // Escape закрывает только просмотр, окно проекта под ним остаётся
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      show(st.index + 1, 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      show(st.index - 1, -1)
    } else if (e.key === '+' || e.key === '=') zoomTo(st.s * 1.6, 0, 0, true)
    else if (e.key === '-') zoomTo(st.s / 1.6, 0, 0, true)
  }

  const current = items[index]
  const single = items.length < 2

  return (
    <dialog
      ref={dlgRef}
      aria-label='Просмотр скриншота'
      className={'viewer' + (closing ? ' is-closing' : '')}
      onCancel={e => {
        e.preventDefault()
        close()
      }}
      onKeyDown={onKeyDown}
    >
      <div ref={stageRef} className='viewer__stage'>
        <img ref={imgRef} src={current?.src} alt={current ? `${title}, скриншот ${index + 1}` : ''} draggable={false} />
      </div>

      <div className='viewer__bar'>
        <span className='text-small text-muted tabular-nums'>{single ? '' : `${index + 1} / ${items.length}`}</span>
        <div className='flex gap-2'>
          <button type='button' className='icon-square max-sm:hidden' aria-label='Отдалить' onClick={() => zoomTo(state.current.s / 1.6, 0, 0, true)}>
            <ZoomOut className='size-5' strokeWidth={1.6} aria-hidden />
          </button>
          <button type='button' className='icon-square max-sm:hidden' aria-label='Приблизить' onClick={() => zoomTo(state.current.s * 1.6, 0, 0, true)}>
            <ZoomIn className='size-5' strokeWidth={1.6} aria-hidden />
          </button>
          <button type='button' className='icon-square' aria-label='Закрыть просмотр' onClick={close}>
            <X className='size-5' strokeWidth={1.6} aria-hidden />
          </button>
        </div>
      </div>

      {!single && (
        <>
          <button type='button' className='icon-square viewer__nav left-6 max-sm:hidden' aria-label='Предыдущий скриншот' disabled={index === 0} onClick={() => show(index - 1, -1)}>
            <ChevronLeft className='size-5' strokeWidth={1.6} aria-hidden />
          </button>
          <button
            type='button'
            className='icon-square viewer__nav right-6 max-sm:hidden'
            aria-label='Следующий скриншот'
            disabled={index === items.length - 1}
            onClick={() => show(index + 1, 1)}
          >
            <ChevronRight className='size-5' strokeWidth={1.6} aria-hidden />
          </button>
        </>
      )}

      <p className='viewer__hint text-small text-muted'>
        <span className='[@media(hover:none)]:hidden'>Колесо мыши или двойной клик приближают. Стрелки листают, Esc закрывает</span>
        <span className='hidden [@media(hover:none)]:inline'>Два пальца приближают, свайп листает, свайп вниз закрывает</span>
      </p>
    </dialog>
  )
})
