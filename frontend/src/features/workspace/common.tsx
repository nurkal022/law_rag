import { useCallback } from 'react'
import { Skeleton, Status } from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import type { DocSource, DocStatus, WsDocument } from './types'

/**
 * Общее для трёх экранов рабочего места: как называется состояние документа,
 * откуда он взялся, как набирается размер и дата.
 *
 * Держать это в каждом экране отдельно нельзя: «не удалось распознать» на
 * одном экране и «ошибка» на другом — про один и тот же документ, и человек
 * решит, что это две разные беды.
 */

export const wsDict: Dict = {
  stPending: { ru: 'обрабатывается', kz: 'өңделуде', en: 'processing' },
  stIndexed: { ru: 'в поиске', kz: 'іздеуде', en: 'searchable' },
  stFailed: { ru: 'не попал в поиск', kz: 'іздеуге енбеді', en: 'not searchable' },

  srcUpload: { ru: 'загружен', kz: 'жүктелген', en: 'uploaded' },
  srcContract: { ru: 'договор', kz: 'шарт', en: 'contract' },
  srcLawProject: { ru: 'законопроект', kz: 'заң жобасы', en: 'draft law' },
  srcChat: { ru: 'из диалога', kz: 'диалогтан', en: 'from chat' },

  unitKb: { ru: 'КБ', kz: 'КБ', en: 'KB' },
  unitMb: { ru: 'МБ', kz: 'МБ', en: 'MB' },

  noMatter: { ru: 'Без дела', kz: 'Іссіз', en: 'No matter' },
  dash: { ru: '—', kz: '—', en: '—' },
}

/* Формы счётного оборота держатся отдельным словарём: в общий они не влезают
   по смыслу — это не подписи интерфейса, а грамматика. */
const countDict: Dict = {
  ruOne: { ru: 'документ', kz: 'құжат', en: 'document' },
  ruFew: { ru: 'документа', kz: 'құжат', en: 'documents' },
  ruMany: { ru: 'документов', kz: 'құжат', en: 'documents' },
  kzDocs: { ru: 'документов', kz: 'құжат', en: 'documents' },
  enDoc: { ru: 'документ', kz: 'құжат', en: 'document' },
  enDocs: { ru: 'документов', kz: 'құжат', en: 'documents' },
}

const STATUS_KEY: Record<DocStatus, string> = {
  pending: 'stPending',
  indexed: 'stIndexed',
  failed: 'stFailed',
}

/**
 * Сбой индексации — не поломка документа: он открывается и скачивается, но
 * не участвует в поиске. Поэтому не 'err', а 'warn': красный цвет здесь
 * пугал бы сильнее, чем того стоит утрата поиска по одному файлу.
 */
const STATUS_KIND: Record<DocStatus, StatusKind> = {
  pending: 'idle',
  indexed: 'ok',
  failed: 'warn',
}

const SOURCE_KEY: Record<DocSource, string> = {
  upload: 'srcUpload',
  contract: 'srcContract',
  law_project: 'srcLawProject',
  chat: 'srcChat',
}

/** Подпись состояния. Название состояния и только оно — причина набирается рядом. */
export function StatusMark({ status }: { status: DocStatus }) {
  const t = useT(wsDict)
  return <Status kind={STATUS_KIND[status]}>{t(STATUS_KEY[status])}</Status>
}

export function useSourceLabel() {
  const t = useT(wsDict)
  return useCallback((source: DocSource) => t(SOURCE_KEY[source] ?? 'srcUpload'), [t])
}

/** Размер файла человеческим числом: байты в реестре никто не читает. */
export function useSize() {
  const t = useT(wsDict)
  const { lang } = useLang()
  return useCallback(
    (bytes: number) => {
      if (!bytes) return t('dash')
      const locale = localeOf(lang)
      if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} ${t('unitKb')}`
      }
      return `${(bytes / 1024 / 1024).toLocaleString(locale, {
        maximumFractionDigits: 1,
      })} ${t('unitMb')}`
    },
    [lang, t],
  )
}

export function localeOf(lang: Lang) {
  return lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU'
}

/** Дата списка. Пустую не выдумываем — ставим прочерк. */
export function whenShort(iso: string | null, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Заглушка списка на время загрузки: строки набора, а не вращающийся круг. */
export function WsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="ws-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i % 3 === 0 ? 18 : 12} width={`${100 - (i % 4) * 12}%`} />
      ))}
    </div>
  )
}

/**
 * Подсветка найденного в отрывке.
 *
 * Разбиение идёт по позициям, а не регулярным выражением из запроса: в
 * запросе легко встречаются скобки и звёздочки, и собранное из них выражение
 * либо падает, либо совпадает не с тем.
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase()
  if (!needle) return <>{text}</>

  const parts: { text: string; hit: boolean }[] = []
  const hay = text.toLowerCase()
  let from = 0
  for (;;) {
    const at = hay.indexOf(needle, from)
    if (at === -1) break
    if (at > from) parts.push({ text: text.slice(from, at), hit: false })
    parts.push({ text: text.slice(at, at + needle.length), hit: true })
    from = at + needle.length
  }
  parts.push({ text: text.slice(from), hit: false })

  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="ws-hit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

/**
 * Сборка абзацев из текста файла.
 *
 * PDF отдаёт текст строками ровно там, где они переносились на странице, и
 * набор «как есть» даёт рваный левый столбец вместо документа. Строка
 * считается продолжением предыдущей только при двух признаках сразу:
 * предыдущая не кончилась знаком конца предложения и текущая начинается со
 * строчной. Признак консервативный: заголовки, пункты и всё, начинающееся с
 * прописной или цифры, остаются отдельными абзацами, и текст не склеивается
 * там, где в файле был настоящий перенос.
 */
export function reflow(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      out.push('')
      continue
    }
    const prev = out.length ? out[out.length - 1] : ''
    const continues = prev && !/[.!?:;»)"]$/.test(prev) && /^[a-zа-яёәғқңөұүhі]/.test(line)
    if (continues) out[out.length - 1] = `${prev} ${line}`
    else out.push(line)
  }
  return out.filter((p) => p !== '')
}

/**
 * Счётный оборот «12 документов».
 *
 * Русский требует трёх форм, и «1 документов» в списке дел выглядит как
 * недоделка. Казахский и английский обходятся одной и двумя.
 */
export function useDocsCount() {
  const t = useT(countDict)
  const { lang } = useLang()
  return useCallback(
    (n: number) => {
      if (lang === 'kz') return `${n} ${t('kzDocs')}`
      if (lang === 'en') return `${n} ${n === 1 ? t('enDoc') : t('enDocs')}`
      const tens = n % 100
      const ones = n % 10
      if (tens >= 11 && tens <= 14) return `${n} ${t('ruMany')}`
      if (ones === 1) return `${n} ${t('ruOne')}`
      if (ones >= 2 && ones <= 4) return `${n} ${t('ruFew')}`
      return `${n} ${t('ruMany')}`
    },
    [lang, t],
  )
}

/** Хотя бы один документ ещё обрабатывается — значит, список надо перечитывать. */
export function anyPending(documents: WsDocument[]) {
  return documents.some((d) => d.status === 'pending')
}
