#!/usr/bin/env node
/**
 * Защита дизайн-системы от расползания.
 *
 * Правило из спеки: цвет, кегль и отступ не пишутся в компонентах литералами —
 * только токенами из tokens.css. Без этой проверки через месяц вернутся те же
 * 27 разошедшихся копий стилей, только на TypeScript.
 *
 * Запуск: npm run lint:tokens
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

/** Единственный файл, где литеральные значения разрешены и обязаны быть. */
const ALLOWED = new Set(['src/styles/tokens.css'])

const RULES = [
  {
    id: 'hex-color',
    re: /#[0-9a-fA-F]{3,8}\b/g,
    msg: 'литеральный цвет — возьми токен из tokens.css (var(--ink), var(--seal), …)',
  },
  {
    id: 'rgb-color',
    re: /\b(?:rgb|rgba|hsl|hsla)[ \t]*\(/g,
    msg: 'литеральный цвет — возьми токен из tokens.css',
  },
  {
    // Значение допустимо, если опирается на токен: var(--x) или calc(var(--x) * 1.4).
    id: 'font-size',
    re: /font-size[ \t]*:([^;{}]+)/g,
    ok: (v) => v.includes('var(') || /^\s*(inherit|unset|revert)\s*$/.test(v),
    msg: 'кегль мимо шкалы — используй var(--t-…-size) или calc() от него',
  },
  {
    id: 'font-family',
    re: /font-family[ \t]*:([^;{}]+)/g,
    ok: (v) => v.includes('var(') || /^\s*inherit\s*$/.test(v),
    msg: 'гарнитура мимо токена — используй var(--font-serif|sans|mono)',
  },
  {
    id: 'shadow',
    re: /box-shadow[ \t]*:([^;{}]+)/g,
    ok: (v) => /^\s*none\s*$/.test(v),
    msg: 'тени запрещены направлением «Документ»',
  },
  {
    // Декоративная охра даёт на бумаге контраст 2.49 — не проходит AA даже
    // для крупного кегля. Текстом набирается только --ochre-ink (4.62).
    id: 'ochre-as-text',
    re: /(?:^|[;{\s])color[ \t]*:([^;{}]*var\(--ochre\)(?![-\w])[^;{}]*)/g,
    msg: 'декоративная охра текстом не проходит по контрасту — var(--ochre-ink) на бумаге, var(--ochre-on-ink) на чернилах',
  },
  {
    id: 'gradient',
    re: /linear-gradient|radial-gradient|conic-gradient/g,
    msg: 'градиенты запрещены направлением «Документ»',
  },
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(css|tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

let failures = 0

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (ALLOWED.has(rel)) continue

  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')

  for (const rule of RULES) {
    lines.forEach((line, i) => {
      // Комментарии не проверяем — в них токены объясняют сами себя
      const code = line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')
      rule.re.lastIndex = 0
      let m
      while ((m = rule.re.exec(code)) !== null) {
        const value = m[1]
        if (rule.ok && value !== undefined && rule.ok(value)) continue
        console.error(`${rel}:${i + 1}  [${rule.id}]  ${m[0].trim()}\n    ${rule.msg}`)
        failures++
      }
    })
  }
}

if (failures > 0) {
  console.error(`\nДизайн-система нарушена в ${failures} мест${failures === 1 ? 'е' : 'ах'}.`)
  process.exit(1)
}

console.log('Дизайн-система цела: литеральных цветов, кеглей, теней и градиентов нет.')
