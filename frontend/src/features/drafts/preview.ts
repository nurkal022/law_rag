import type { DocTree, Party, PartyKind, Passport, PassportField, Ref } from './types'
import type { Lang } from '../../i18n'

/**
 * Лист документа на клиенте.
 *
 * Тот же каркас, что собирает docengine/skeleton.py, но без обращения к
 * серверу. Иначе конструктор ждал бы ответ на каждое нажатие клавиши, а смысл
 * экрана ровно в обратном: человек печатает наименование стороны и тут же
 * видит его в преамбуле готового договора.
 *
 * Расхождение с сервером здесь допустимо только в мелочах оформления: после
 * нажатия «Составить договор» лист приходит с сервера и заменяет этот.
 */

/** Код языка движка: в интерфейсе казахский — kz, в документах — kk. */
export type DocLang = 'ru' | 'kk' | 'en'

export function docLang(lang: Lang): DocLang {
  return lang === 'kz' ? 'kk' : lang
}

/** Реквизиты стороны, которые ищутся в форме (см. PARTY_ATTRS в skeleton.py). */
export const PARTY_ATTRS = [
  'name',
  'id_no',
  'address',
  'phone',
  'email',
  'bank',
  'iban',
  'bik',
  'signatory',
  'signatory_role',
  'basis',
] as const

export type PartyAttr = (typeof PARTY_ATTRS)[number]

/** Ключ значения формы для реквизита стороны, если паспорт не объявил своё поле. */
export function partyKey(idx: number, attr: string) {
  return `party${idx}_${attr}`
}

/** Поле паспорта, отвечающее за реквизит стороны, — если оно там объявлено. */
export function passportPartyField(
  passport: Passport,
  idx: number,
  attr: string,
): PassportField | undefined {
  return passport.fields.find(
    (f) => f.party === idx && (f.name === attr || f.name.endsWith('_' + attr)),
  )
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export function partyValue(
  passport: Passport,
  values: Record<string, unknown>,
  idx: number,
  attr: string,
): string {
  const field = passportPartyField(passport, idx, attr)
  if (field) {
    const v = str(values[field.name])
    if (v) return v
  }
  return str(values[partyKey(idx, attr)])
}

function first(values: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = str(values[k])
    if (v) return v
  }
  return ''
}

/* --------------------------------- преамбула --------------------------------- */

const TAIL: Record<DocLang, string> = {
  ru: 'заключили настоящий договор о нижеследующем:',
  kk: 'осы шартты төмендегілер туралы жасасты:',
  en: 'have entered into this agreement as follows:',
}

const SIDES: Record<DocLang, string[]> = {
  ru: ['с одной стороны', 'с другой стороны', 'с третьей стороны', 'с четвёртой стороны'],
  kk: ['бір тараптан', 'екінші тараптан', 'үшінші тараптан', 'төртінші тараптан'],
  en: ['on the one hand', 'on the other hand', 'on the third hand', 'on the fourth hand'],
}

const NAMED: Record<DocLang, [string, string]> = {
  ru: ['именуемое в дальнейшем', 'именуемый в дальнейшем'],
  kk: ['бұдан әрі', 'бұдан әрі'],
  en: ['hereinafter referred to as', 'hereinafter referred to as'],
}

const ID_WORD: Record<DocLang, [string, string]> = {
  ru: ['БИН', 'ИИН'],
  kk: ['БСН', 'ЖСН'],
  en: ['BIN', 'IIN'],
}

const BLANK_NAME = '____________________'
const BLANK_ID = '____________'

/** Описание одной стороны для преамбулы — копия party_phrase из skeleton.py. */
export function partyPhrase(party: Party, lang: DocLang): string {
  const name = party.name || BLANK_NAME
  const [binWord, iinWord] = ID_WORD[lang]
  const [neuter, masc] = NAMED[lang]
  const parts: string[] = []
  let named = masc

  if (party.kind === 'legal') {
    parts.push(name, `${binWord} ${party.id_no || BLANK_ID}`)
    if (party.signatory) {
      const role = party.signatory_role || (lang === 'ru' ? 'директора' : 'director')
      if (lang === 'ru') {
        parts.push(`в лице ${role} ${party.signatory}`)
        parts.push(`действующего на основании ${party.basis || 'устава'}`)
      } else if (lang === 'kk') {
        parts.push(`${role} ${party.signatory} атынан`)
        parts.push(`${party.basis || 'жарғы'} негізінде әрекет ететін`)
      } else {
        parts.push(`represented by ${role} ${party.signatory}`)
        parts.push(`acting on the basis of the ${party.basis || 'charter'}`)
      }
    }
    named = neuter
  } else if (party.kind === 'ip') {
    if (lang === 'ru') parts.push(`индивидуальный предприниматель ${name}`)
    else if (lang === 'kk') parts.push(`жеке кәсіпкер ${name}`)
    else parts.push(`individual entrepreneur ${name}`)
    parts.push(`${iinWord} ${party.id_no || BLANK_ID}`)
    if (lang === 'ru') {
      parts.push(
        `действующий на основании ${party.basis || 'свидетельства о государственной регистрации'}`,
      )
    }
  } else {
    parts.push(name, `${iinWord} ${party.id_no || BLANK_ID}`)
  }

  parts.push(`${named} «${party.role}»`)
  return parts.filter(Boolean).join(', ')
}

export function buildPreamble(parties: Party[], lang: DocLang): string {
  if (!parties.length) return ''
  const sides = SIDES[lang]
  const chunks = parties.map((p, i) => `${partyPhrase(p, lang)}, ${sides[Math.min(i, sides.length - 1)]}`)
  const joiner = lang === 'ru' ? ', и ' : lang === 'kk' ? ', және ' : ', and '
  return `${chunks.join(joiner)}, ${TAIL[lang]}`
}

/* ---------------------------------- каркас ---------------------------------- */

export function buildParties(passport: Passport, values: Record<string, unknown>): Party[] {
  return passport.parties.map((spec, idx) => {
    const raw = partyValue(passport, values, idx, 'kind')
    const fallback: PartyKind = spec.kinds[0] ?? 'legal'
    const kind: PartyKind =
      raw === 'legal' || raw === 'individual' || raw === 'ip' ? raw : fallback
    const party: Party = {
      role: spec.role,
      kind,
      name: '',
      id_no: '',
      address: '',
      phone: '',
      email: '',
      bank: '',
      iban: '',
      bik: '',
      signatory: '',
      signatory_role: '',
      basis: '',
    }
    for (const attr of PARTY_ATTRS) {
      party[attr] = partyValue(passport, values, idx, attr)
    }
    return party
  })
}

/** Каркас документа для предпросмотра: реквизиты, преамбула, пустые разделы. */
export function buildPreviewTree(
  passport: Passport,
  values: Record<string, unknown>,
  lang: DocLang,
): DocTree {
  const parties = buildParties(passport, values)
  return {
    meta: {
      kind: 'contract',
      type_id: passport.id,
      lang,
      title: passport.name,
      subtitle: passport.summary || null,
      form: passport.form || null,
      legal_basis: passport.legal_basis.map(parseRefLabel),
    },
    requisites: {
      number: first(values, 'number', 'contract_number', 'doc_number'),
      city: first(values, 'city', 'place', 'city_of_signing'),
      date: first(values, 'date', 'contract_date', 'sign_date') || today(),
      parties,
    },
    preamble: buildPreamble(parties, lang),
    sections: passport.sections.map((s, i) => ({
      no: String(i + 1),
      key: s.key,
      title: s.title,
      clauses: [],
      pending: true,
    })),
    tables: [],
    annexes: [],
    issues: [],
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/* -------------------------------- координаты -------------------------------- */

/** Подпись правовой координаты: «ГК РК ст. 546, п. 2». */
export function refLabel(ref: Ref): string {
  const base = `${ref.act} ст. ${ref.article}`
  return ref.note ? `${base}, ${ref.note}` : base
}

/**
 * Обратный разбор: паспорт отдаёт координаты уже строкой, а лист рисует их из
 * объектов. Разобранное verified=false намеренно: строка из паспорта не
 * проверялась по корпусу, и выдавать её за выверенную нельзя.
 */
export function parseRefLabel(label: string): Ref {
  const m = /^(.*?)\s+ст\.\s*([^,]+)(?:,\s*(.*))?$/.exec(label)
  if (!m) return { act: label, article: '', note: null, verified: false }
  return { act: m[1], article: m[2].trim(), note: m[3] ?? null, verified: false }
}

/* ---------------------------- существенные условия ---------------------------- */

export function hasValue(values: Record<string, unknown>, name: string): boolean {
  const v = values[name]
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

/** Закрыто ли существенное условие данными формы (ст. 393 ГК РК). */
export function termCovered(fields: string[], values: Record<string, unknown>): boolean {
  return fields.some((name) => hasValue(values, name))
}
