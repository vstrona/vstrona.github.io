'use client'

/**
 * Первый экран: керамическое «ядро», которое при наведении (или нажатии) раскладывается на пять
 * пластин, по одной на каждый этап создания сайта, а под ним имя во всю ширину.
 *
 * Основа: блок Syntra hero (motionuikit), переделанный под этот сайт: чёрно-белая гамма, русские
 * тексты, этапы работы вместо слоёв AI-платформы. Убраны сетка пола, ореолы, стеклянные панели,
 * номера этапов и чужой логотип: на крышке ядра теперь монограмма «ВС».
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, SVGProps } from 'react'
import {
  LazyMotion,
  animate,
  domAnimation,
  m,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform
} from 'motion/react'
import type { MotionValue } from 'motion/react'
import { ArrowUpRight, Code2, MessageSquareText, MousePointer2, PenTool, Rocket, Server } from 'lucide-react'
import { cn } from '@/lib/utils'

const BLOCK_CSS = `
.n3-enter { animation: n3-enter 1100ms cubic-bezier(0.22, 1, 0.36, 1) 250ms backwards; }
@keyframes n3-enter { from { opacity: 0; scale: 0.97; } }

@keyframes n3-float {
  from { transform: translateY(0); }
  to { transform: translateY(calc(var(--n3-float, 6) * -1px)); }
}
.n3-float { animation: n3-float var(--n3-float-seconds, 6.5s) ease-in-out infinite alternate; }

/* Карточки этапов: ступень тона вместо стекла, тени и рамки */
.n3-stage-card {
  background: var(--color-surface);
  transition: background-color 300ms ease;
}
.n3-stage-card-lit { background: var(--color-surface-2); }

@media (prefers-reduced-motion: reduce) {
  .n3-enter, .n3-float { animation: none; }
}
`

/* ───────────── Изометрия ───────────── */

const ISO_X = 0.866
const ISO_Y = 0.5
const CX = 500
const CY = 500
const RING_FLATTEN = 0.57
const RING_RX = [400, 530] as const

type SlabType = { half: number; radius: number; top: number; depth: number }

const BASE: SlabType = { half: 168, radius: 40, top: 475, depth: 34 }
const SEAM_GAP = 9
const MID: SlabType = { half: 151, radius: 36, top: BASE.top - SEAM_GAP - 28, depth: 28 }
const CAP: SlabType = { half: 101, radius: 28, top: MID.top - 14, depth: 14 }

type Point = [number, number]

const round = (n: number) => Math.round(n * 100) / 100

const project = (x: number, y: number, cx = CX, cy = CY): Point => [cx + (x - y) * ISO_X, cy + (x + y) * ISO_Y]

const footprint = (half: number, radius: number, steps = 14): Point[] => {
  const r = Math.min(radius, half)
  const c = half - r
  const corners: [number, number, number][] = [
    [c, c, 0],
    [-c, c, 90],
    [-c, -c, 180],
    [c, -c, 270]
  ]
  const pts: Point[] = []

  for (const [ox, oy, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = ((start + (90 * i) / steps) * Math.PI) / 180

      pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a)])
    }
  }

  return pts
}

const toPath = (pts: Point[]) => `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`

const topPath = (slab: SlabType, inset = 0, cx = CX, dy = 0) => {
  const half = slab.half - inset
  const radius = Math.max(slab.radius - inset, 1)

  return toPath(footprint(half, radius).map(([x, y]) => project(x, y, cx, slab.top + dy)))
}

const hull = (points: Point[]): Point[] => {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const build = (list: Point[]) => {
    const out: Point[] = []

    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }

    out.pop()

    return out
  }

  return [...build(pts), ...build([...pts].reverse())]
}

const bodyPath = (slab: SlabType, inset = 0) => {
  const half = slab.half - inset
  const radius = Math.max(slab.radius - inset, 1)
  const outline = footprint(half, radius)
  const upper = outline.map(([x, y]) => project(x, y, CX, slab.top))
  const lower = outline.map(([x, y]) => project(x, y, CX, slab.top + slab.depth))

  return toPath(hull([...upper, ...lower]))
}

const facePoint = (slab: SlabType, side: 'left' | 'right', u: number, v: number): Point => {
  const { half, top, depth } = slab

  if (side === 'left') {
    const [x, y] = project(-half + 2 * half * u, half, CX, top)

    return [x, y + depth * v]
  }

  const [x, y] = project(half, half - 2 * half * u, CX, top)

  return [x, y + depth * v]
}

const FACE_MATRIX = {
  left: `${ISO_X} ${ISO_Y} 0 1`,
  right: `${ISO_X} ${-ISO_Y} 0 1`,
  top: `${ISO_X} ${ISO_Y} ${-ISO_X} ${ISO_Y}`
}

const ringPoint = (rx: number, angleDeg: number): Point => {
  const a = (angleDeg * Math.PI) / 180

  return [round(CX + rx * Math.cos(a)), round(CY + rx * RING_FLATTEN * Math.sin(a))]
}

const ringPath = (rx: number) => {
  const ry = rx * RING_FLATTEN

  return `M${CX + rx} ${CY}A${rx} ${ry} 0 1 1 ${CX - rx} ${CY}A${rx} ${ry} 0 1 1 ${CX + rx} ${CY}Z`
}

/* ───────────── Детали ядра ───────────── */

const INK = '#141414'

type FaceProps = { slab: SlabType; side: 'left' | 'right'; u: number; v: number }

const FaceMark = ({ slab, side, u, v, w, h, fill }: FaceProps & { w: number; h: number; fill: string }) => {
  const [x, y] = facePoint(slab, side, u, v)

  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) matrix(${FACE_MATRIX[side]} 0 0)`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} />
    </g>
  )
}

const PanelLine = ({ slab, side, v, from = 0.14, to = 0.86 }: { slab: SlabType; side: 'left' | 'right'; v: number; from?: number; to?: number }) => {
  const [x1, y1] = facePoint(slab, side, from, v)
  const [x2, y2] = facePoint(slab, side, to, v)

  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke='#9c9c9c' strokeWidth='0.9' opacity='0.55' />
}

const Fastener = ({ slab, x, y }: { slab: SlabType; x: number; y: number }) => {
  const [px, py] = project(x, y, CX, slab.top)

  return (
    <g transform={`translate(${px.toFixed(2)} ${py.toFixed(2)}) matrix(${FACE_MATRIX.top} 0 0)`}>
      <circle r='6.5' fill='url(#n3-hole)' stroke='#c4c4c4' strokeWidth='1' />
    </g>
  )
}

const SlabBody = ({ slab }: { slab: SlabType }) => (
  <g>
    <path d={bodyPath(slab)} fill='url(#n3-side)' />
    <path d={bodyPath(slab)} fill='url(#n3-side-shade)' />
    <path d={bodyPath(slab)} fill='none' stroke='#cdcdcd' strokeWidth='1' opacity='0.85' />
  </g>
)

const SlabTop = ({ slab, groove }: { slab: SlabType; groove?: number }) => (
  <g>
    <path d={topPath(slab)} fill='url(#n3-bevel)' stroke='#d6d6d6' strokeWidth='1' />
    <path d={topPath(slab, 4.5)} fill='url(#n3-top)' stroke='#fff' strokeWidth='1' />
    {groove !== undefined && <path d={topPath(slab, groove)} fill='none' stroke='#d8d8d8' strokeWidth='1.2' />}
  </g>
)

// Монограмма «ВС», выдавленная из крышки: тёмные слои снизу, верхняя грань чуть светлее.
const MARK_SIDE = ['#050505', '#0b0b0b', '#111111', '#161616', '#1b1b1b', '#202020']

const CoreMark = ({ x, y }: { x: number; y: number }) => {
  const plane = (lift: number) => `translate(${x} ${y - lift}) matrix(${FACE_MATRIX.top} 0 0) rotate(-45)`
  const text = {
    textAnchor: 'middle' as const,
    dominantBaseline: 'central' as const,
    fontSize: 46,
    fontWeight: 500,
    letterSpacing: -2,
    fontFamily: 'Onest, ui-sans-serif, system-ui, sans-serif'
  }

  return (
    <g aria-hidden>
      {MARK_SIDE.map((fill, k) => (
        <text key={fill} {...text} transform={plane(k)} fill={fill}>
          ВС
        </text>
      ))}
      <text {...text} transform={plane(MARK_SIDE.length)} fill='#2c2c2c'>
        ВС
      </text>
    </g>
  )
}

const CoreDefs = () => (
  <defs>
    <linearGradient id='n3-side' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stopColor='#f4f4f4' />
      <stop offset='0.46' stopColor='#e8e8e8' />
      <stop offset='0.5' stopColor='#d6d6d6' />
      <stop offset='1' stopColor='#e0e0e0' />
    </linearGradient>
    <linearGradient id='n3-side-shade' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0.45' stopColor='#000' stopOpacity='0' />
      <stop offset='1' stopColor='#000' stopOpacity='0.2' />
    </linearGradient>
    <linearGradient id='n3-bevel' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stopColor='#ffffff' />
      <stop offset='1' stopColor='#e2e2e2' />
    </linearGradient>
    <linearGradient id='n3-top' x1='0.1' y1='0' x2='0.9' y2='1'>
      <stop offset='0' stopColor='#ffffff' />
      <stop offset='1' stopColor='#eeeeee' />
    </linearGradient>
    <linearGradient id='n3-inlay' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stopColor='#ebebeb' />
      <stop offset='1' stopColor='#ffffff' />
    </linearGradient>
    <linearGradient id='n3-slot' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stopColor='#3c3c3c' />
      <stop offset='1' stopColor='#6c6c6c' />
    </linearGradient>
    <radialGradient id='n3-hole' cx='0.5' cy='0.4' r='0.7'>
      <stop offset='0' stopColor='#d2d2d2' />
      <stop offset='1' stopColor='#f2f2f2' />
    </radialGradient>
    <filter id='n3-blur-spill' x='-40%' y='-40%' width='180%' height='180%'>
      <feGaussianBlur stdDeviation='18' />
    </filter>
  </defs>
)

// Шов между нижней и средней плитой: тёмная щель, а не подсветка.
const SEAM: SlabType = { half: MID.half - 2, radius: MID.radius - 2, top: MID.top + MID.depth - 1, depth: SEAM_GAP + 1 }

const MidDetails = () => (
  <>
    <PanelLine slab={MID} side='left' v={0.78} />
    <PanelLine slab={MID} side='right' v={0.78} />
    <FaceMark slab={MID} side='left' u={0.62} v={0.42} w={34} h={7.5} fill='url(#n3-slot)' />
    <FaceMark slab={MID} side='left' u={0.34} v={0.42} w={5} h={5} fill='url(#n3-slot)' />
    <FaceMark slab={MID} side='left' u={0.42} v={0.42} w={5} h={5} fill='url(#n3-slot)' />
    <FaceMark slab={MID} side='right' u={0.44} v={0.42} w={5} h={5} fill='url(#n3-slot)' />
    <FaceMark slab={MID} side='right' u={0.52} v={0.42} w={5} h={5} fill='url(#n3-slot)' />
    <FaceMark slab={MID} side='right' u={0.68} v={0.42} w={22} h={4.5} fill='url(#n3-slot)' />
    <FaceMark slab={MID} side='left' u={0.2} v={0.42} w={7} h={2.6} fill={INK} />
    <Fastener slab={MID} x={0} y={-MID.half + 28} />
    <Fastener slab={MID} x={-MID.half + 28} y={0} />
    <Fastener slab={MID} x={MID.half - 28} y={0} />
    <Fastener slab={MID} x={0} y={MID.half - 28} />
  </>
)

const BaseDetails = () => (
  <>
    <FaceMark slab={BASE} side='right' u={0.5} v={0.62} w={4.5} h={4.5} fill='url(#n3-slot)' />
    <FaceMark slab={BASE} side='right' u={0.58} v={0.62} w={4.5} h={4.5} fill='url(#n3-slot)' />
    <FaceMark slab={BASE} side='right' u={0.66} v={0.62} w={4.5} h={4.5} fill='url(#n3-slot)' />
    <FaceMark slab={BASE} side='left' u={0.32} v={0.62} w={4.5} h={4.5} fill='url(#n3-slot)' />
    <FaceMark slab={BASE} side='left' u={0.4} v={0.62} w={4.5} h={4.5} fill='url(#n3-slot)' />
  </>
)

const CapInlay = ({ slab }: { slab: SlabType }) => (
  <>
    <path d={topPath(slab, 19)} fill='url(#n3-inlay)' stroke='#dadada' strokeWidth='1.2' />
    <path d={topPath(slab, 20.5)} fill='none' stroke='#fff' strokeWidth='1' opacity='0.9' />
  </>
)

/** Ядро в покое: три плиты и монограмма на крышке. */
const CoreObject = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 1000 1000' aria-hidden {...props}>
    <CoreDefs />
    <SlabBody slab={BASE} />
    <SlabTop slab={BASE} groove={10} />
    <PanelLine slab={BASE} side='left' v={0.3} />
    <PanelLine slab={BASE} side='right' v={0.3} />
    <BaseDetails />
    <path d={bodyPath(SEAM)} fill={INK} />
    <SlabBody slab={MID} />
    <SlabTop slab={MID} groove={11} />
    <MidDetails />
    <SlabBody slab={CAP} />
    <SlabTop slab={CAP} />
    <CapInlay slab={CAP} />
    <CoreMark x={CX} y={CAP.top} />
  </svg>
)

/* ───────────── Настройки ───────────── */

const MOTION = {
  floatDistance: 10,
  floatSeconds: 6.5,
  tiltDegrees: 3.5,
  ringParallax: 12,
  orbitSeconds: [70, 95],
  orbitOpenOpacity: 0.15
}

const ARTBOARD = 1000

/**
 * Пять этапов снизу вверх: от задачи до запуска. Главный слой посередине: разработка.
 */
const STAGES = [
  { title: 'Задача', items: ['Бриф', 'Структура', 'Тексты'], icon: MessageSquareText, side: 'right' },
  { title: 'Дизайн', items: ['Макет', 'Адаптив', 'Анимации'], icon: PenTool, side: 'left' },
  { title: 'Разработка', items: ['Вёрстка', 'Логика', 'Админка'], icon: Code2, side: 'right', main: true },
  { title: 'Боты и сервер', items: ['Telegram бот', 'База данных', 'HTTPS'], icon: Server, side: 'left' },
  { title: 'Запуск', items: ['Домен', 'SEO', 'Видеообзор'], icon: Rocket, side: 'right' }
] as const

type Stage = (typeof STAGES)[number]

const isMain = (stage: Stage) => 'main' in stage && stage.main

const EXPLODE = {
  spring: { stiffness: 105, damping: 25, mass: 1 },
  gap: 94,
  aiLift: 12,
  topPlateY: 230,
  stagger: 0.05,
  scales: [0.63, 0.62, 0.7, 1.07, 1.06]
}

const STAGE_CARDS = {
  left: { edge: -2, width: 31 },
  right: { edge: 0, width: 29 },
  restInset: 10,
  outward: 2,
  beadSeconds: 1.6
}

/* ───────────── Раскладка ───────────── */

const PLATE_SLABS: SlabType[] = [
  { ...BASE, top: BASE.top + 17, depth: 17 },
  { ...BASE, top: BASE.top, depth: 17 },
  MID,
  { ...CAP, top: CAP.top + 7, depth: 7 },
  { ...CAP, top: CAP.top, depth: 7 }
]

const MAIN_PLATE = 2

const TARGET_TOPS = PLATE_SLABS.map(
  (_, i) => EXPLODE.topPlateY + (PLATE_SLABS.length - 1 - i) * EXPLODE.gap - (i === MAIN_PLATE ? EXPLODE.aiLift : 0)
)

const TRAVEL = PLATE_SLABS.map((slab, i) => TARGET_TOPS[i] - slab.top)

const clamp = (v: number) => Math.min(1, Math.max(0, v))

const plateProgress = (i: number, p: number) => {
  const delay = Math.abs(i - MAIN_PLATE) * EXPLODE.stagger

  return clamp((p - delay) / (1 - delay))
}

const plateY = (i: number, p: number) => TRAVEL[i] * plateProgress(i, p)
const plateScale = (i: number, p: number) => 1 + (EXPLODE.scales[i] - 1) * plateProgress(i, p)

const tipOffset = (i: number) => {
  const { half, radius } = PLATE_SLABS[i]

  return 0.866 * (2 * half - 0.586 * radius) * EXPLODE.scales[i]
}

const tipX = (i: number, side: 'left' | 'right') => CX + (side === 'right' ? 1 : -1) * tipOffset(i)
const cornerY = (i: number) => TARGET_TOPS[i] + PLATE_SLABS[i].depth / 2

/* ───────────── Ядро в разборе ───────────── */

const SKIRT = [0, 4, 0, 10, 10]

const Plate = ({ index, progress, children }: { index: number; progress: MotionValue<number>; children: ReactNode }) => {
  const y = useTransform(progress, v => plateY(index, v))
  const scale = useTransform(progress, v => plateScale(index, v))
  const apart = useTransform(progress, v => plateProgress(index, v))
  const spill = useTransform(apart, v => v * 0.2)
  const slab = PLATE_SLABS[index]
  const skirt = SKIRT[index]

  return (
    <m.g style={{ y, scale }}>
      {index > 0 && (
        <m.path d={topPath(slab, -6, CX, slab.depth + 34)} fill='#000' filter='url(#n3-blur-spill)' style={{ opacity: spill }} />
      )}
      {skirt > 0 && (
        <m.g style={{ opacity: apart }}>
          <SlabBody slab={{ ...slab, top: slab.top + slab.depth - 1, depth: skirt + 1 }} />
        </m.g>
      )}
      {children}
    </m.g>
  )
}

// Знак «код» на главной плите, лежит в плоскости её верхней грани.
const MainPlateMark = ({ progress }: { progress: MotionValue<number> }) => {
  const on = useTransform(progress, v => clamp((v - 0.5) / 0.4))

  return (
    <m.g style={{ opacity: on }} transform={`translate(${CX} ${MID.top}) matrix(${FACE_MATRIX.top} 0 0)`}>
      <circle r='56' fill='none' stroke={INK} strokeWidth='1.4' />
      <circle r='38' fill='none' stroke={INK} strokeWidth='1' strokeDasharray='3 6' />
      <circle r='9' fill={INK} />
    </m.g>
  )
}

const ExplodedCore = ({ progress, ...props }: SVGProps<SVGSVGElement> & { progress: MotionValue<number> }) => (
  <svg viewBox='0 0 1000 1000' aria-hidden {...props}>
    <CoreDefs />

    <Plate index={0} progress={progress}>
      <SlabBody slab={PLATE_SLABS[0]} />
      <SlabTop slab={PLATE_SLABS[0]} groove={10} />
      <BaseDetails />
    </Plate>

    <Plate index={1} progress={progress}>
      <SlabBody slab={PLATE_SLABS[1]} />
      <SlabTop slab={PLATE_SLABS[1]} groove={10} />
      <PanelLine slab={BASE} side='left' v={0.3} />
      <PanelLine slab={BASE} side='right' v={0.3} />
    </Plate>

    <Plate index={MAIN_PLATE} progress={progress}>
      <path d={bodyPath(SEAM)} fill={INK} />
      <SlabBody slab={MID} />
      <SlabTop slab={MID} groove={11} />
      <MidDetails />
      <MainPlateMark progress={progress} />
    </Plate>

    <Plate index={3} progress={progress}>
      <SlabBody slab={PLATE_SLABS[3]} />
      <SlabTop slab={PLATE_SLABS[3]} />
      <CapInlay slab={PLATE_SLABS[3]} />
    </Plate>

    <Plate index={4} progress={progress}>
      <SlabBody slab={PLATE_SLABS[4]} />
      <SlabTop slab={PLATE_SLABS[4]} />
      <CapInlay slab={CAP} />
      <CoreMark x={CX} y={CAP.top} />
    </Plate>
  </svg>
)

/* ───────────── Бусины на орбитах ───────────── */

const BEADS: { ring: 0 | 1; angle: number; size: number }[] = [
  { ring: 0, angle: 20, size: 7 },
  { ring: 0, angle: 110, size: 5.5 },
  { ring: 0, angle: 200, size: 8 },
  { ring: 0, angle: 290, size: 6 },
  { ring: 1, angle: 60, size: 6 },
  { ring: 1, angle: 132, size: 8 },
  { ring: 1, angle: 204, size: 5.5 },
  { ring: 1, angle: 276, size: 7 },
  { ring: 1, angle: 348, size: 6.5 }
]

/**
 * Бусины рисуются дважды: за ядром и перед ним, каждая половина обрезана своей половиной
 * холста, поэтому бусина на дальней стороне орбиты уходит за ядро.
 */
const Beads = ({ half, animate: run, paused = false, ...props }: SVGProps<SVGSVGElement> & { half: 'back' | 'front'; animate: boolean; paused?: boolean }) => {
  const ref = useRef<SVGSVGElement>(null)
  const clipId = `n3-clip-${half}`
  const gradId = `n3-bead-${half}`

  useEffect(() => {
    const svg = ref.current

    if (!svg) return

    if (paused) svg.pauseAnimations()
    else svg.unpauseAnimations()
  }, [paused])

  return (
    <svg ref={ref} viewBox='0 0 1000 1000' aria-hidden {...props}>
      <defs>
        <clipPath id={clipId}>
          {half === 'back' ? <rect x='-200' y='-200' width='1400' height={CY + 200} /> : <rect x='-200' y={CY} width='1400' height='700' />}
        </clipPath>
        <radialGradient id={gradId} cx='0.35' cy='0.3' r='0.75'>
          <stop offset='0' stopColor='#ffffff' />
          <stop offset='1' stopColor='#8c8c8c' />
        </radialGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {BEADS.map((bead, i) => {
          const rx = RING_RX[bead.ring]
          const [x, y] = ringPoint(rx, bead.angle)
          const dur = MOTION.orbitSeconds[bead.ring]
          const reverse = bead.ring === 1
          const start = bead.angle / 360
          const begin = -dur * (reverse ? 1 - start : start)

          return (
            <g key={i} transform={run ? undefined : `translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <circle r={bead.size} fill={`url(#${gradId})`} />
              {run && (
                <animateMotion
                  dur={`${dur}s`}
                  begin={`${begin}s`}
                  repeatCount='indefinite'
                  path={ringPath(rx)}
                  {...(reverse && { keyPoints: '1;0', keyTimes: '0;1', calcMode: 'linear' })}
                />
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/* ───────────── Карточки этапов ───────────── */

const StageCardBody = ({ index }: { index: number }) => {
  const stage = STAGES[index]
  const Icon = stage.icon

  return (
    <div className='grid grid-cols-[1.35em_minmax(0,1fr)] items-start gap-x-[0.6em]'>
      <span className='flex h-[1.3em] items-center'>
        <Icon className='size-[1.15em] text-ink' strokeWidth={1.6} aria-hidden />
      </span>
      <div>
        <p className='text-[1.05em] leading-[1.25] font-medium text-ink md:whitespace-nowrap'>{stage.title}</p>
        <p className='mt-[0.3em] text-[0.95em] leading-[1.45] text-muted'>{stage.items.join(', ')}</p>
      </div>
    </div>
  )
}

const pct = (n: number) => `${(n / ARTBOARD) * 100}%`
const cardDirection = (index: number) => (STAGES[index].side === 'left' ? -1 : 1)

type StageCardProps = { index: number; progress: MotionValue<number>; open: boolean; lit: boolean; onHover: (index: number | null) => void }

const StageCard = ({ index, progress, open, lit, onHover }: StageCardProps) => {
  const opacity = useTransform(progress, [0.35, 0.9], [0, 1])
  // Закрытые карточки скрыты целиком, а не только прозрачны: их не читает экранный диктор
  const visibility = useTransform(progress, v => (v < 0.36 ? 'hidden' : 'visible'))
  const x = useTransform(progress, [0, 1], [-cardDirection(index) * STAGE_CARDS.restInset, cardDirection(index) * STAGE_CARDS.outward])
  const stage = STAGES[index]
  const { edge, width } = STAGE_CARDS[stage.side]
  const left = stage.side === 'left' ? edge : 100 - edge - width

  return (
    <li style={{ top: pct(cornerY(index)), left: `${left}%`, width: `${width}%` }} className='absolute -translate-y-1/2'>
      <m.div
        style={{ opacity, x, visibility }}
        onPointerEnter={e => e.pointerType === 'mouse' && onHover(index)}
        onPointerLeave={() => onHover(null)}
        className={cn('n3-stage-card px-[0.9em] py-[0.8em]', open && 'pointer-events-auto', lit && 'n3-stage-card-lit')}
      >
        <StageCardBody index={index} />
      </m.div>
    </li>
  )
}

const StageCards = ({ progress, open, hovered, onHover }: { progress: MotionValue<number>; open: boolean; hovered: number | null; onHover: (index: number | null) => void }) => (
  <ol aria-label='Этапы создания сайта' className='pointer-events-none absolute inset-0 m-0 hidden list-none p-0 text-[clamp(14px,1.8cqw,16px)] md:block'>
    {STAGES.map((stage, i) => (
      <StageCard key={stage.title} index={i} progress={progress} open={open} lit={hovered === i} onHover={onHover} />
    ))}
  </ol>
)

/* ───────────── Линии от карточек к пластинам ───────────── */

const lineEnds = (plate: number, card: number, side: 'left' | 'right') => {
  const dir = side === 'right' ? 1 : -1

  return { plateX: plate + dir * 7, nodeX: card - dir * 10 }
}

type ConnectorProps = { plate: number; card: number; y: number; side: 'left' | 'right'; index: number; lit: boolean; active: boolean; progress: MotionValue<number>; className?: string }

const StageConnector = ({ plate, card, y, side, index, lit, active, progress, className }: ConnectorProps) => {
  const show = useTransform(progress, [0.55, 0.9], [0, 1])
  const t = useMotionValue(0)
  const { plateX, nodeX } = lineEnds(plate, card, side)
  const beadX = useTransform(t, k => nodeX + (plateX - nodeX) * k)
  const beadOpacity = useTransform([t, show], ([k, s]: number[]) => s * Math.sin(Math.PI * k))

  useEffect(() => {
    if (!active) return

    const controls = animate(t, [0, 1], { duration: STAGE_CARDS.beadSeconds, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.4, delay: 0.5 + index * 0.25 })

    return () => {
      controls.stop()
      t.set(0)
    }
  }, [active, index, t])

  return (
    <m.svg aria-hidden viewBox={`0 0 ${ARTBOARD} ${ARTBOARD}`} style={{ opacity: show }} className={className}>
      <line x1={plateX} x2={nodeX} y1={y} y2={y} stroke='#4a4a4a' strokeWidth='1' />
      <m.line x1={plateX} x2={nodeX} y1={y} y2={y} stroke='#f2f2f2' strokeWidth='1.2' initial={false} animate={{ opacity: lit ? 0.9 : 0 }} transition={{ duration: 0.25 }} />
      <circle cx={plateX} cy={y} r='2.6' fill='#9a9a9a' />
      <circle cx={nodeX} cy={y} r='3.6' fill='#f2f2f2' />
      <m.circle cx={beadX} cy={y} r='2.6' fill='#f2f2f2' style={{ opacity: beadOpacity }} />
    </m.svg>
  )
}

const StageConnectors = ({ progress, active, hovered }: { progress: MotionValue<number>; active: boolean; hovered: number | null }) => (
  <div className='pointer-events-none absolute inset-0 hidden md:block'>
    {STAGES.map((stage, i) => {
      const { edge, width } = STAGE_CARDS[stage.side]
      const cardEdge = stage.side === 'left' ? (edge + width) * 10 : (100 - edge - width) * 10

      return (
        <StageConnector
          key={stage.title}
          plate={tipX(i, stage.side)}
          card={cardEdge}
          y={cornerY(i)}
          side={stage.side}
          index={i}
          lit={hovered === i}
          active={active}
          progress={progress}
          className='pointer-events-none absolute inset-0 size-full overflow-visible'
        />
      )
    })}
  </div>
)

/* ───────────── Ядро целиком ───────────── */

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)

  return () => document.removeEventListener('visibilitychange', onChange)
}

const ParallaxLayer = ({ x, y, reach, children }: { x: MotionValue<number>; y: MotionValue<number>; reach: number; children: ReactNode }) => {
  const tx = useTransform(x, v => v * reach)
  const ty = useTransform(y, v => v * reach)

  return (
    <m.div style={{ x: tx, y: ty }} className='pointer-events-none absolute inset-0'>
      {children}
    </m.div>
  )
}

const Tilted = ({ rotateX, rotateY, children }: { rotateX: MotionValue<number>; rotateY: MotionValue<number>; children: ReactNode }) => (
  <div className='pointer-events-none absolute inset-0 [perspective:1400px]'>
    <m.div style={{ rotateX, rotateY }} className='absolute inset-0'>
      <div className='n3-float absolute inset-0'>{children}</div>
    </m.div>
  </div>
)

export const SyntraCore = ({ className, style }: { className?: string; style?: CSSProperties }) => {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const pointerType = useRef('mouse')
  const visualRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion() ?? false
  const onScreen = useInView(visualRef, { initial: true, margin: '40px' })
  const pageVisible = useSyncExternalStore(subscribeToVisibility, () => !document.hidden, () => true)

  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const x = useSpring(px, { stiffness: 55, damping: 18, mass: 0.9 })
  const y = useSpring(py, { stiffness: 55, damping: 18, mass: 0.9 })
  const rotateY = useTransform(x, v => v * MOTION.tiltDegrees)
  const target = useMotionValue(0)
  const progress = useSpring(target, reduce ? { duration: 0.01 } : EXPLODE.spring)
  const rotateX = useTransform([y, progress], ([v, p]: number[]) => v * -MOTION.tiltDegrees + p * 4)
  const restOpacity = useTransform(progress, [0, 0.04], [1, 0])
  const explodedOpacity = useTransform(progress, [0, 0.03], [0, 1])
  const orbitOpacity = useTransform(progress, [0, 0.6], [1, MOTION.orbitOpenOpacity])
  const hintOpacity = useTransform(progress, [0, 0.25], [1, 0])
  // Без анимации ядро сразу стоит раскрытым: этапы видны целиком, без перехода
  const isOpen = open || reduce
  const beadsPaused = isOpen || !onScreen || !pageVisible

  useEffect(() => {
    target.set(isOpen ? 1 : 0)
  }, [isOpen, target])

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return

    const box = e.currentTarget.getBoundingClientRect()

    px.set(((e.clientX - box.left) / box.width - 0.5) * 2)
    py.set(((e.clientY - box.top) / box.height - 0.5) * 2)
  }

  const handlePointerLeave = () => {
    px.set(0)
    py.set(0)
    setOpen(false)
  }

  const handleCardHover = (index: number | null) => {
    setHovered(index)
    if (index !== null && !reduce) setOpen(true)
  }

  // Мышь раскрывает ядро наведением, палец и клавиатура переключают нажатием.
  const handleCoreClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0 || pointerType.current !== 'mouse') setOpen(v => !v)
  }

  return (
    <LazyMotion features={domAnimation}>
      <style>{BLOCK_CSS}</style>
      <div
        ref={visualRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ ['--n3-float' as string]: MOTION.floatDistance, ['--n3-float-seconds' as string]: `${MOTION.floatSeconds}s`, ...style }}
        className={cn('n3-enter @container relative aspect-square', className)}
      >
        <div className='absolute inset-0'>
          <ParallaxLayer x={x} y={y} reach={MOTION.ringParallax}>
            <m.div style={{ opacity: orbitOpacity }} className='absolute inset-0'>
              <Beads half='back' animate={!reduce} paused={beadsPaused} className='absolute inset-0 size-full overflow-visible' />
            </m.div>
          </ParallaxLayer>

          <Tilted rotateX={rotateX} rotateY={rotateY}>
            <m.div style={{ opacity: restOpacity }} className='absolute inset-0'>
              <CoreObject className='absolute inset-0 size-full overflow-visible' />
            </m.div>
            <m.div style={{ opacity: explodedOpacity }} className='absolute inset-0'>
              <ExplodedCore progress={progress} className='absolute inset-0 size-full overflow-visible' />
            </m.div>
            <StageConnectors progress={progress} active={open && !reduce} hovered={hovered} />
          </Tilted>

          <ParallaxLayer x={x} y={y} reach={MOTION.ringParallax}>
            <m.div style={{ opacity: orbitOpacity }} className='absolute inset-0'>
              <Beads half='front' animate={!reduce} paused={beadsPaused} className='absolute inset-0 size-full overflow-visible' />
            </m.div>
          </ParallaxLayer>

          <Tilted rotateX={rotateX} rotateY={rotateY}>
            <StageCards progress={progress} open={isOpen} hovered={hovered} onHover={handleCardHover} />
          </Tilted>
        </div>

        <m.p
          aria-hidden
          style={{ opacity: hintOpacity }}
          className='pointer-events-none absolute top-[66%] left-1/2 m-0 hidden -translate-x-1/2 md:flex items-center gap-2 text-sm whitespace-nowrap text-muted'
        >
          <MousePointer2 className='size-4 text-ink' strokeWidth={1.6} />
          <span className='[@media(hover:none)]:hidden'>Наведите на ядро, оно разложится на этапы</span>
          <span className='hidden [@media(hover:none)]:inline'>Нажмите на ядро, оно разложится на этапы</span>
        </m.p>

        <button
          type='button'
          aria-expanded={isOpen}
          aria-label='Показать этапы создания сайта'
          onPointerDown={e => (pointerType.current = e.pointerType)}
          onPointerEnter={e => e.pointerType === 'mouse' && !reduce && setOpen(true)}
          onClick={handleCoreClick}
          onBlur={() => setOpen(false)}
          className='absolute top-[30%] left-[22%] h-[44%] w-[56%] cursor-pointer rounded-[3rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'
        />
      </div>
    </LazyMotion>
  )
}

/* ───────────── Имя во всю ширину ───────────── */

/**
 * Подбирает кегль так, чтобы самая длинная строка заняла всю ширину. На телефоне имя
 * разбивается на две строки по словам.
 */
const useFitText = (lines: string[]) => {
  const ref = useRef<HTMLHeadingElement>(null)
  const [size, setSize] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current

    if (!el) return

    const probe = document.createElement('span')
    const fit = () => {
      const cs = getComputedStyle(el)

      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.fontWeight} 100px ${cs.fontFamily};letter-spacing:-0.05em`
      document.body.appendChild(probe)

      const widest = Math.max(
        ...lines.map(line => {
          probe.textContent = line

          return probe.getBoundingClientRect().width
        })
      )

      probe.remove()
      setSize(Math.floor((el.clientWidth / widest) * 100 * 0.995))
    }

    fit()

    const observer = new ResizeObserver(fit)

    observer.observe(el)
    document.fonts?.ready.then(fit)

    return () => observer.disconnect()
  }, [lines.join('|')])

  return { ref, size }
}

type HeroLink = { label: string; href: string; external?: boolean; desktopOnly?: boolean }

type SyntraHeroProps = {
  name: string
  lead: string
  action: { label: string; href: string }
  links: HeroLink[]
}

const SyntraHero = ({ name, lead, action, links }: SyntraHeroProps) => {
  const words = name.split(' ')
  const [isPhone, setIsPhone] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  const fit = useFitText(isPhone ? words : [name])
  const heroRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion() ?? false
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const nameScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.93])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = () => setIsPhone(mq.matches)

    mq.addEventListener('change', onChange)

    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <LazyMotion features={domAnimation}>
      <header className='absolute top-0 right-0 z-30 px-gutter pt-6'>
        <nav aria-label='Разделы'>
          <ul className='m-0 flex list-none gap-5 p-0 text-small sm:gap-7'>
            {links.map(link => (
              <li key={link.href} className={cn(link.desktopOnly && 'hidden sm:block')}>
                <a
                  href={link.href}
                  {...(link.external && { target: '_blank', rel: 'noopener' })}
                  className='link-quiet text-ink'
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section ref={heroRef} id='top' aria-labelledby='hero-title' className='relative flex min-h-svh flex-col overflow-x-clip'>
        {/* Верхняя часть экрана: ядро. Холст квадратный и больше области, лишнее пустое. */}
        <div className='hero-stage relative shrink-0'>
          <SyntraCore className='hero-core absolute left-1/2 -translate-x-1/2' />
        </div>

        <div className='relative z-10 flex flex-1 flex-col justify-between gap-8 px-gutter pt-6 pb-7'>
          <div className='rise flex flex-col gap-6 max-sm:order-last sm:flex-row sm:items-start sm:justify-between sm:gap-10' style={{ animationDelay: '0.35s' }}>
            <p className='m-0 max-w-[44rem] text-lead text-ink'>{lead}</p>
            <a href={action.href} target='_blank' rel='noopener' className='btn-solid shrink-0 self-start'>
              {action.label}
              <ArrowUpRight className='size-4' strokeWidth={1.8} aria-hidden />
            </a>
          </div>

          <m.h1
            ref={fit.ref}
            id='hero-title'
            style={{ fontSize: fit.size ?? undefined, scale: nameScale }}
            className='rise m-0 origin-bottom-left font-light leading-[0.85] tracking-[-0.05em] text-ink'
          >
            {isPhone ? (
              words.map(word => (
                <span key={word} className='block'>
                  {word}
                </span>
              ))
            ) : (
              <span className='block whitespace-nowrap'>{name}</span>
            )}
          </m.h1>
        </div>
      </section>
    </LazyMotion>
  )
}

export default SyntraHero
