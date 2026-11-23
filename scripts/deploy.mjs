// Публикация на GitHub Pages: собирает сайт и кладёт папку dist в ветку gh-pages.
// Исходники живут в main, готовый сайт только в gh-pages. Запуск: npm run deploy
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' })
const read = cmd => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()

const remote = read('git remote get-url origin')
const commit = read('git rev-parse --short HEAD')

run('npm run build')

if (!existsSync(path.join(dist, 'index.html'))) throw new Error('Сборка не создала dist/index.html')

// Без этого файла GitHub прогоняет сайт через Jekyll и прячет файлы с подчёркиванием
writeFileSync(path.join(dist, '.nojekyll'), '')

// В dist отдельный временный репозиторий с одной веткой gh-pages
run('git init -q -b gh-pages', dist)
run('git add -A', dist)
run(`git commit -q -m "Сайт из ${commit}"`, dist)
run(`git push -f -q ${remote} gh-pages`, dist)

console.log(`\nОпубликовано: ветка gh-pages, сборка из ${commit}. Сайт обновится через минуту.`)
