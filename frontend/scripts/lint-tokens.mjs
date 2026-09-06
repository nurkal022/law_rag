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

/**
 * Имена токенов, объявленных в tokens.css.
 *
 * Нужны для проверки, что var(--что-то) ссылается на существующее. Без неё
 * опечатка в имени тихо превращается в запасное значение — а если запасного
 * нет, свойство просто исчезает, и заметить это можно только глазами.
 */
function declaredTokens() {
  const text = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8')
  const names = new Set()
  for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) names.add(m[1])
  return names
}

/** Свойства, объявленные в самом файле: компонент вправе завести своё. */
function localTokens(text) {
  const names = new Set()
  for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) names.add(m[1])
  return names
}

/**
 * Свойства, приходящие из разметки, а не из таблицы стилей.
 *
 * --i — номер элемента в ленте, его задаёт JSX через style: очередь появления
 * зависит от данных, и объявить её в токенах нельзя.
 */
const FROM_MARKUP = new Set(['--i'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(css|tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

let failures = 0
const TOKENS = declaredTokens()

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (ALLOWED.has(rel)) continue

  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const own = localTokens(text)

  // Ссылка на несуществующий токен. Именно так литеральные величины и
  // просачиваются в систему: var(--measure-wide, 62rem) выглядит как
  // обращение к токену, а на деле подставляет литерал, и ни одно правило
  // ниже его не видит.
  lines.forEach((line, i) => {
    const code = line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')
    for (const m of code.matchAll(/var\(\s*(--[\w-]+)([^)]*)\)/g)) {
      const [full, name, rest] = m
      if (TOKENS.has(name) || own.has(name) || FROM_MARKUP.has(name)) {
        // Запасное значение уместно там, где свойство может отсутствовать:
        // var(--i, 0) для элемента без номера в ленте. Ловим другое —
        // спрятанные в запасном значении размеры и цвета: именно так
        // литералы и просачиваются мимо остальных правил.
        const fallback = rest.trim().replace(/^,/, '').trim()
        const hidesLiteral = /\d\s*(px|rem|em|ch|vh|vw|%)|#[0-9a-fA-F]{3,8}/.test(fallback)
        if (fallback && hidesLiteral) {
          console.error(`${rel}:${i + 1}  [token-fallback]  ${full.trim()}\n    ` +
            'запасное значение в var() прячет литерал от проверок — оставь только токен')
          failures++
        }
        continue
      }
      console.error(`${rel}:${i + 1}  [unknown-token]  ${full.trim()}\n    ` +
        `токен ${name} не объявлен в tokens.css — опечатка или забытое объявление`)
      failures++
    }
  })

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
