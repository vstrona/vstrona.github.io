import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CoreHero from '@/components/ui/syntra-hero'
import './index.css'

// Весь сайт обычный HTML, React рисует только первый экран с 3D-ядром
const mount = document.getElementById('top')

if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <CoreHero />
    </StrictMode>
  )
}
