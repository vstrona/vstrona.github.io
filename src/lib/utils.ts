import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Свои размеры текста (text-small, text-body…) и цвета (text-ink, text-muted) объявлены
// в index.css. tailwind-merge о них не знает, поэтому подсказываем ему, что это разные группы.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['small', 'body', 'lead', 'head'] }],
      'text-color': [{ text: ['ink', 'muted', 'ground'] }]
    }
  }
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Копирует текст. Если Clipboard API запрещён (встроенные браузеры, старые WebView),
// копирует через скрытое поле. Возвращает true, если получилось.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = document.createElement('textarea')

    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(field)
    field.select()

    let ok = false

    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }

    field.remove()
    return ok
  }
}
