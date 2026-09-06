import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from '../../shared/nav'
import {
  Body,
  Button,
  Caption,
  Display,
  Empty,
  H2,
  Input,
  Label,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { api, errorMessage } from '../../shared/api'
import { LoadFailure, useLoader } from '../drafts/shared'
import { SectionTabs } from './SectionTabs'
import { WsSkeleton, localeOf, whenShort } from './common'
import type { DeleteMatterResponse, Matter, MatterResponse, MattersResponse } from './types'
import './workspace.css'
import './workspace.motion.css'
import './workspace.pages.css'

/**
 * Дела: папки, в которые складываются документы по одному вопросу.
 *
 * Удаление дела на сервере документы не трогает — они выходят из папки и
 * остаются в библиотеке. Об этом сказано прямо в подтверждении, с числом:
 * человек, увидевший «удалить дело с 12 документами», откажется от действия,
 * которое ничем ему не грозит.
 */

const dict: Dict = {
  title: { ru: 'Дела', kz: 'Істер', en: 'Matters' },
  subtitle: {
    ru: 'Папки, объединяющие документы по одному вопросу',
    kz: 'Бір мәселе бойынша құжаттарды біріктіретін қалталар',
    en: 'Folders that group documents around one question',
  },
  create: { ru: 'Новое дело', kz: 'Жаңа іс', en: 'New matter' },
  active: { ru: 'В работе', kz: 'Жұмыста', en: 'Active' },
  archived: { ru: 'В архиве', kz: 'Мұрағатта', en: 'Archived' },
  docs: { ru: 'документов', kz: 'құжат', en: 'documents' },
  updated: { ru: 'Изменено', kz: 'Өзгертілген', en: 'Updated' },
  noDesc: { ru: 'Описание не заполнено', kz: 'Сипаттама толтырылмаған', en: 'No description' },

  formTitle: { ru: 'Название дела', kz: 'Іс атауы', en: 'Matter title' },
  formTitlePh: {
    ru: 'Например: Спор с подрядчиком по договору подряда',
    kz: 'Мысалы: Мердігерлік шарт бойынша мердігермен дау',
    en: 'For example: Dispute with a contractor under a works agreement',
  },
  formDesc: { ru: 'Описание', kz: 'Сипаттама', en: 'Description' },
  formDescPh: {
    ru: 'Коротко: что за вопрос, какие документы соберутся в деле',
    kz: 'Қысқаша: қандай мәселе, іске қандай құжаттар жиналады',
    en: 'Briefly: what the question is and which documents will gather here',
  },
  save: { ru: 'Создать', kz: 'Құру', en: 'Create' },
  saveEdit: { ru: 'Сохранить', kz: 'Сақтау', en: 'Save' },
  cancel: { ru: 'Отмена', kz: 'Болдырмау', en: 'Cancel' },
  created: { ru: 'Дело создано', kz: 'Іс құрылды', en: 'Matter created' },
  failSave: { ru: 'Сохранить не удалось', kz: 'Сақтау мүмкін болмады', en: 'Could not save' },

  rename: { ru: 'Переименовать', kz: 'Атын өзгерту', en: 'Rename' },
  archive: { ru: 'В архив', kz: 'Мұрағатқа', en: 'Archive' },
  unarchive: { ru: 'Вернуть в работу', kz: 'Жұмысқа қайтару', en: 'Reactivate' },
  remove: { ru: 'Удалить дело', kz: 'Істі жою', en: 'Delete matter' },
  removeAsk: {
    ru: 'Удалить дело? Документы останутся в библиотеке — они просто выйдут из этого дела.',
    kz: 'Іс жойылсын ба? Құжаттар кітапханада қалады — олар тек осы істен шығады.',
    en: 'Delete the matter? The documents stay in the library — they simply leave this matter.',
  },
  removeCount: { ru: 'Выйдут из дела', kz: 'Істен шығады', en: 'Will leave the matter' },
  removeYes: { ru: 'Удалить дело', kz: 'Істі жою', en: 'Delete matter' },
  removed: { ru: 'Дело удалено', kz: 'Іс жойылды', en: 'Matter deleted' },
  freed: {
    ru: 'документов вернулось в библиотеку без дела',
    kz: 'құжат кітапханаға іссіз оралды',
    en: 'documents returned to the library without a matter',
  },
  failRemove: { ru: 'Удалить не удалось', kz: 'Жою мүмкін болмады', en: 'Could not delete' },

  openDocs: { ru: 'Документы дела', kz: 'Істің құжаттары', en: 'Documents in this matter' },

  emptyTitle: { ru: 'Дел пока нет', kz: 'Әзірге іс жоқ', en: 'No matters yet' },
  emptyBody: {
    ru: 'Дело собирает документы по одному вопросу: договор, спор, сделка. Создайте первое — и переносите в него файлы из библиотеки.',
    kz: 'Іс бір мәселе бойынша құжаттарды жинайды: шарт, дау, мәміле. Алғашқысын құрып, кітапханадан файлдарды көшіріңіз.',
    en: 'A matter collects the documents for one question: a contract, a dispute, a deal. Create the first one and move files into it.',
  },
}

export function MattersPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const locale = localeOf(lang)
  const toast = useToast()

  const { data, error, loading, reload, setData } = useLoader<MattersResponse>(
    () => api.get<MattersResponse>('/workspace/matters?archived=1'),
    [],
  )

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const matters = data?.matters ?? []
  const put = useCallback(
    (next: Matter) =>
      setData({ matters: (data?.matters ?? []).map((m) => (m.id === next.id ? next : m)) }),
    [data, setData],
  )

  const create = useCallback(async () => {
    const name = title.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const res = await api.post<MatterResponse>('/workspace/matters', {
        title: name,
        description: desc.trim() || undefined,
      })
      setData({ matters: [res.matter, ...(data?.matters ?? [])] })
      setTitle('')
      setDesc('')
      setOpen(false)
      toast(`${t('created')}: ${res.matter.title}`, 'ok')
    } catch (e) {
      toast(errorMessage(e, t('failSave')), 'err')
    } finally {
      setBusy(false)
    }
  }, [title, desc, busy, data, setData, t, toast])

  const patch = useCallback(
    async (m: Matter, body: Record<string, unknown>) => {
      try {
        const res = await api.patch<MatterResponse>(`/workspace/matters/${m.id}`, body)
        put({ ...res.matter, documents_count: m.documents_count })
      } catch (e) {
        toast(errorMessage(e, t('failSave')), 'err')
      }
    },
    [put, t, toast],
  )

  const remove = useCallback(
    async (m: Matter) => {
      setConfirmId(null)
      try {
        const res = await api.del<DeleteMatterResponse>(`/workspace/matters/${m.id}`)
        setData({ matters: (data?.matters ?? []).filter((x) => x.id !== m.id) })
        toast(
          res.documents_freed
            ? `${t('removed')}. ${res.documents_freed} ${t('freed')}`
            : t('removed'),
          'ok',
        )
      } catch (e) {
        toast(errorMessage(e, t('failRemove')), 'err')
      }
    },
    [data, setData, t, toast],
  )

  const active = matters.filter((m) => !m.is_archived)
  const archived = matters.filter((m) => m.is_archived)

  const group = (items: Matter[], label: string) =>
    items.length ? (
      <>
        <div className="ws-group-head">
          <Label>{label}</Label>
          <Caption tone="mute">{items.length}</Caption>
        </div>
        <div className="ws-matters">
          {items.map((m, i) => (
            <div
              key={m.id}
              className={
                m.is_archived
                  ? 'ws-matter-row ws-matter-row--archived enter-item'
                  : 'ws-matter-row enter-item'
              }
              style={{ '--i': i } as CSSProperties}
            >
              {editId === m.id ? (
                <MatterForm
                  matter={m}
                  onCancel={() => setEditId(null)}
                  onSave={async (title_, description) => {
                    await patch(m, { title: title_, description })
                    setEditId(null)
                  }}
                />
              ) : (
                <>
                  <Link
                    /* Дело — это фильтр библиотеки: переход открывает реестр с
                       уже выбранным делом, а не ещё один список тех же строк. */
                    to={`/workspace?matter=${m.id}`}
                    className="ws-matter ws-matter--flat"
                    aria-label={`${t('openDocs')}: ${m.title}`}
                  >
                    <span className="ws-matter__main">
                      <H2 as="span">{m.title}</H2>
                      <Body as="span" tone="mute" style={{ margin: 0 }}>
                        {m.description || t('noDesc')}
                      </Body>
                    </span>
                    <span className="ws-matter__meta">
                      <UIText tone="ink2">
                        {m.documents_count} {t('docs')}
                      </UIText>
                      <Caption tone="mute">
                        {t('updated')}: {whenShort(m.updated_at, locale)}
                      </Caption>
                    </span>
                  </Link>

                  {confirmId === m.id ? (
                    <div className="ws-matter__confirm swap">
                      <Body style={{ margin: 0 }}>{t('removeAsk')}</Body>
                      <Caption tone="mute">
                        {t('removeCount')}: {m.documents_count}
                      </Caption>
                      <div className="ws-form__acts">
                        <Button variant="danger" onClick={() => void remove(m)}>
                          {t('removeYes')}
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmId(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="ws-matter__acts">
                      <Button variant="ghost" onClick={() => setEditId(m.id)}>
                        <Caption>{t('rename')}</Caption>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void patch(m, { is_archived: !m.is_archived })}
                      >
                        <Caption>{m.is_archived ? t('unarchive') : t('archive')}</Caption>
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmId(m.id)}>
                        <Caption>{t('remove')}</Caption>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </>
    ) : null

  return (
    <div className="page">
      <SectionTabs />
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('subtitle')}</Body>
        </div>
        <div className="ws-actions">
          <Button variant="primary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {t('create')}
          </Button>
        </div>
      </div>

      {open ? (
        <form
          className="ws-form unfold"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <Input
            label={t('formTitle')}
            placeholder={t('formTitlePh')}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <Textarea
            label={t('formDesc')}
            placeholder={t('formDescPh')}
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.currentTarget.value)}
          />
          <div className="ws-form__acts">
            <Button variant="primary" type="submit" disabled={!title.trim() || busy}>
              {t('save')}
            </Button>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <WsSkeleton rows={5} />
      ) : error ? (
        <div className="ws-state">
          <LoadFailure error={error} onRetry={reload} />
        </div>
      ) : !matters.length ? (
        <div className="ws-state">
          <Empty
            title={t('emptyTitle')}
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                {t('create')}
              </Button>
            }
          >
            {t('emptyBody')}
          </Empty>
        </div>
      ) : (
        <>
          {group(active, t('active'))}
          {group(archived, t('archived'))}
        </>
      )}
    </div>
  )
}

/** Переименование на месте: отдельный экран ради одной строки не нужен. */
function MatterForm({
  matter,
  onSave,
  onCancel,
}: {
  matter: Matter
  onSave: (title: string, description: string) => Promise<void>
  onCancel: () => void
}) {
  const t = useT(dict)
  const [title, setTitle] = useState(matter.title)
  const [desc, setDesc] = useState(matter.description ?? '')
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="ws-form ws-form--inline unfold"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() || busy) return
        setBusy(true)
        void onSave(title.trim(), desc.trim()).finally(() => setBusy(false))
      }}
    >
      <Input
        label={t('formTitle')}
        value={title}
        autoFocus
        onChange={(e) => setTitle(e.currentTarget.value)}
      />
      <Textarea
        label={t('formDesc')}
        rows={2}
        value={desc}
        onChange={(e) => setDesc(e.currentTarget.value)}
      />
      <div className="ws-form__acts">
        <Button variant="primary" type="submit" disabled={!title.trim() || busy}>
          {t('saveEdit')}
        </Button>
        <Button variant="ghost" type="button" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
