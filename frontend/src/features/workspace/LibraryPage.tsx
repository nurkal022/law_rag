import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Body,
  Button,
  Caption,
  Chip,
  Display,
  Empty,
  Input,
  Mono,
  Status,
  Table,
  TableTitle,
  UIText,
} from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import './workspace.css'

const dict: Dict = {
  title: { ru: 'Мои документы', kz: 'Менің құжаттарым', en: 'My documents' },
  subtitle: {
    ru: 'Личная библиотека: загруженные файлы и созданное в TURA',
    kz: 'Жеке кітапхана: жүктелген файлдар және TURA-да жасалғаны',
    en: 'Personal library: uploaded files and documents created in TURA',
  },
  upload: { ru: 'Загрузить', kz: 'Жүктеу', en: 'Upload' },
  search: { ru: 'Поиск по своим документам', kz: 'Өз құжаттарыңнан іздеу', en: 'Search your documents' },
  drop: {
    ru: 'Перетащите PDF или DOCX сюда — до 20 МБ',
    kz: 'PDF немесе DOCX файлын осында сүйреңіз — 20 МБ дейін',
    en: 'Drag a PDF or DOCX here — up to 20 MB',
  },
  dropOver: { ru: 'Отпустите файл', kz: 'Файлды жіберіңіз', en: 'Drop the file' },
  choose: { ru: 'Выбрать файл', kz: 'Файл таңдау', en: 'Choose file' },
  colDoc: { ru: 'Документ', kz: 'Құжат', en: 'Document' },
  colMatter: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  colSource: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  colStatus: { ru: 'Статус', kz: 'Күйі', en: 'Status' },
  all: { ru: 'Все', kz: 'Барлығы', en: 'All' },
  noMatter: { ru: 'Без дела', kz: 'Іссіз', en: 'No matter' },
  dash: { ru: '—', kz: '—', en: '—' },
  srcUpload: { ru: 'загружен', kz: 'жүктелген', en: 'uploaded' },
  srcTura: { ru: 'создан в TURA', kz: 'TURA-да жасалған', en: 'created in TURA' },
  stIndexed: { ru: 'проиндексирован', kz: 'индекстелген', en: 'indexed' },
  stPending: { ru: 'индексируется…', kz: 'индекстелуде…', en: 'indexing…' },
  stFailed: { ru: 'не распознан', kz: 'танылмады', en: 'not recognised' },
  retry: { ru: 'Повторить', kz: 'Қайталау', en: 'Retry' },
  retryAria: {
    ru: 'Переиндексировать документ',
    kz: 'Құжатты қайта индекстеу',
    en: 'Re-index document',
  },
  emptyTitle: { ru: 'Библиотека пуста', kz: 'Кітапхана бос', en: 'The library is empty' },
  emptyBody: {
    ru: 'Загрузите договор, устав или доверенность — TURA проиндексирует документ и сможет отвечать по нему со ссылками на нормы РК.',
    kz: 'Шартты, жарғыны немесе сенімхатты жүктеңіз — TURA құжатты индекстеп, ҚР нормаларына сілтемемен жауап береді.',
    en: 'Upload a contract, charter or power of attorney — TURA will index it and answer questions with references to Kazakhstan law.',
  },
  emptyFilterTitle: { ru: 'Ничего не найдено', kz: 'Ештеңе табылмады', en: 'Nothing found' },
  emptyFilterBody: {
    ru: 'В этом деле пока нет документов. Снимите фильтр или загрузите файл.',
    kz: 'Бұл істе әзірге құжат жоқ. Сүзгіні алып тастаңыз немесе файл жүктеңіз.',
    en: 'This matter has no documents yet. Clear the filter or upload a file.',
  },
}

type Source = 'upload' | 'tura'
type DocStatus = 'indexed' | 'pending' | 'failed'

interface DocRow {
  id: string
  title: string
  ref: string
  matter: string | null
  source: Source
  status: DocStatus
}

/** Замоканный реестр — до подключения /api/workspace/documents. */
const DOCS: DocRow[] = [
  { id: '47-p', title: 'Договор поставки № 47-П', ref: 'DOC-2026-047', matter: 'ТОО «Астана Логистик»', source: 'upload', status: 'indexed' },
  { id: 'lease-sk', title: 'Договор аренды складского помещения', ref: 'DOC-2026-051', matter: 'Аренда склада на Рыскулова', source: 'upload', status: 'indexed' },
  { id: 'charter', title: 'Устав ТОО «Астана Логистик»', ref: 'DOC-2026-012', matter: 'ТОО «Астана Логистик»', source: 'upload', status: 'indexed' },
  { id: 'poa', title: 'Доверенность на представительство в суде', ref: 'DOC-2026-063', matter: 'Спор с АО «КазТрансСервис»', source: 'tura', status: 'indexed' },
  { id: 'nda', title: 'Соглашение о неразглашении с подрядчиком', ref: 'DOC-2026-070', matter: null, source: 'tura', status: 'pending' },
  { id: 'claim', title: 'Претензия о взыскании неустойки', ref: 'DOC-2026-072', matter: 'Спор с АО «КазТрансСервис»', source: 'tura', status: 'indexed' },
  { id: 'bill', title: 'Законопроект о внесении изменений в Закон «О госзакупках»', ref: 'DOC-2026-058', matter: null, source: 'tura', status: 'indexed' },
  { id: 'labor', title: 'Трудовой договор с директором филиала', ref: 'DOC-2026-039', matter: 'Кадровые документы', source: 'upload', status: 'failed' },
  { id: 'act', title: 'Акт сверки взаиморасчётов за 2025 год', ref: 'DOC-2026-044', matter: 'ТОО «Астана Логистик»', source: 'upload', status: 'failed' },
  { id: 'protocol', title: 'Протокол общего собрания участников', ref: 'DOC-2026-018', matter: 'Аренда склада на Рыскулова', source: 'upload', status: 'indexed' },
]

const STATUS_KIND: Record<DocStatus, StatusKind> = {
  indexed: 'ok',
  pending: 'warn',
  failed: 'err',
}

const STATUS_KEY: Record<DocStatus, string> = {
  indexed: 'stIndexed',
  pending: 'stPending',
  failed: 'stFailed',
}

const MATTERS = [
  'ТОО «Астана Логистик»',
  'Аренда склада на Рыскулова',
  'Спор с АО «КазТрансСервис»',
  'Кадровые документы',
]

export function LibraryPage() {
  const t = useT(dict)
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [over, setOver] = useState(false)

  const rows = useMemo(
    () =>
      DOCS.filter((d) => {
        if (filter === 'none' && d.matter !== null) return false
        if (filter !== 'all' && filter !== 'none' && d.matter !== filter) return false
        const q = query.trim().toLowerCase()
        if (q && !d.title.toLowerCase().includes(q)) return false
        return true
      }),
    [filter, query],
  )

  const onDrag = (e: DragEvent<HTMLDivElement>, state: boolean) => {
    e.preventDefault()
    setOver(state)
  }

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('subtitle')}</Body>
        </div>
        <div className="ws-actions">
          <Button variant="primary">{t('upload')}</Button>
        </div>
      </div>

      <div className="ws-filters">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('all')} · {DOCS.length}
        </Chip>
        {MATTERS.map((m) => (
          <Chip key={m} active={filter === m} onClick={() => setFilter(m)}>
            {m}
          </Chip>
        ))}
        <Chip active={filter === 'none'} onClick={() => setFilter('none')}>
          {t('noMatter')}
        </Chip>
        <div className="ws-search">
          <Input
            type="search"
            value={query}
            placeholder={t('search')}
            aria-label={t('search')}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
      </div>

      <div
        className={over ? 'ws-drop ws-drop--over' : 'ws-drop'}
        onDragOver={(e) => onDrag(e, true)}
        onDragEnter={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDrop={(e) => onDrag(e, false)}
      >
        <Body tone="mute" style={{ margin: 0 }}>
          {over ? t('dropOver') : t('drop')}
        </Body>
        <Button variant="secondary">{t('choose')}</Button>
      </div>

      {rows.length === 0 ? (
        <Empty
          title={DOCS.length === 0 ? t('emptyTitle') : t('emptyFilterTitle')}
          action={<Button variant="primary">{t('upload')}</Button>}
        >
          {DOCS.length === 0 ? t('emptyBody') : t('emptyFilterBody')}
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">{t('colDoc')}</th>
              <th scope="col">{t('colMatter')}</th>
              <th scope="col" className="ws-col-src">
                {t('colSource')}
              </th>
              <th scope="col" className="ws-col-status">
                {t('colStatus')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="ws-cell-doc">
                    <Link to={`/workspace/documents/${d.id}`}>
                      <TableTitle>{d.title}</TableTitle>
                    </Link>
                    <Mono tone="mute">{d.ref}</Mono>
                  </div>
                </td>
                <td>
                  {d.matter ? (
                    <UIText tone="ink2">{d.matter}</UIText>
                  ) : (
                    <UIText tone="mute">{t('dash')}</UIText>
                  )}
                </td>
                <td className="ws-col-src">
                  <Mono tone="mute">{d.source === 'upload' ? t('srcUpload') : t('srcTura')}</Mono>
                </td>
                <td className="ws-col-status">
                  <div className="ws-status-cell">
                    <Status kind={STATUS_KIND[d.status]}>{t(STATUS_KEY[d.status])}</Status>
                    {d.status === 'failed' ? (
                      <Button variant="ghost" aria-label={`${t('retryAria')}: ${d.title}`}>
                        <Caption>{t('retry')}</Caption>
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
