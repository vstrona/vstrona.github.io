import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CoreHero from '@/components/ui/syntra-hero'
import WorksFolders from '@/components/works-folders'
import './index.css'

// Весь сайт обычный HTML, React рисует первый экран с 3D-ядром и папки с работами
const mount = document.getElementById('top')

if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <CoreHero />
    </StrictMode>
  )
}

const grid = document.getElementById('works-grid')

if (grid && window.WORKS?.length) {
  grid.textContent = ''
  grid.className = 'works__folders'
  createRoot(grid).render(
    <StrictMode>
      <WorksFolders works={window.WORKS} />
    </StrictMode>
  )
}
