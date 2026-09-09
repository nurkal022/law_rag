import { useCallback, useState } from 'react'
import { api, errorMessage } from '../../shared/api'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { useToast } from '../../shared/ui'

/**
 * Заполнение конструктора примером.
 *
 * На показе форму из полутора десятков полей не набирают руками — но и
 * подсовывать «тест-тест» нельзя: документ по такой форме показывать стыдно.
 * Значения приходят с сервера из паспорта типа (поле `example`), поэтому
 * остаются согласованными с составом формы.
 *
 * Заполнение не молчит: человек должен понимать, что перед ним образец, а не
 * его дело — иначе демонстрационные реквизиты уедут в настоящий документ.
 */

const dict: Dict = {
  fill: { ru: 'Заполнить примером', kz: 'Үлгімен толтыру', en: 'Fill with an example' },
  filling: { ru: 'Заполняю…', kz: 'Толтырудамын…', en: 'Filling…' },
  done: {
    ru: 'Форма заполнена вымышленным примером — замените данные перед реальной работой',
    kz: 'Форма ойдан шығарылған үлгімен толтырылды — нақты жұмыс алдында деректерді ауыстырыңыз',
    en: 'The form is filled with a fictitious example — replace the data before real work',
  },
  failed: {
    ru: 'Не удалось получить пример',
    kz: 'Үлгіні алу мүмкін болмады',
    en: 'Could not load the example',
  },
}

export function useDemoFill(typeId: string, lang: string, apply: (values: Record<string, string>) => void) {
  const t = useT(dict)
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const fill = useCallback(() => {
    if (busy || !typeId) return
    setBusy(true)
    api
      .get<{ values: Record<string, string> }>(`/drafts/passport/${typeId}/demo?lang=${lang}`)
      .then((r) => {
        apply(r.values ?? {})
        toast(t('done'))
      })
      .catch((e) => toast(errorMessage(e, t('failed')), 'err'))
      .finally(() => setBusy(false))
  }, [busy, typeId, lang, apply, toast, t])

  return { fill, busy, label: busy ? t('filling') : t('fill') }
}
