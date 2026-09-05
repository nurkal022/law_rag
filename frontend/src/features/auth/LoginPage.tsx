import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from '../../shared/nav'
import { Body, Button, Caption, Cite, Display, Input, Label, Legal, UIText } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import './auth.css'

const dict: Dict = {
  claim: {
    ru: 'Ответы по праву Казахстана — со ссылкой на норму, а не пересказом.',
    kz: 'Қазақстан құқығы бойынша жауаптар — мазмұндама емес, нормаға сілтемемен.',
    en: 'Answers on Kazakhstan law — with the norm cited, not paraphrased.',
  },
  sampleLabel: { ru: 'Пример ответа', kz: 'Жауап үлгісі', en: 'Sample answer' },
  sampleText: {
    ru: 'Срок исковой давности по общему правилу — три года; течение начинается со дня, когда лицо узнало о нарушении права.',
    kz: 'Талап қою мерзімі жалпы ереже бойынша — үш жыл; ол тұлға құқығының бұзылғанын білген күннен басталады.',
    en: 'The general limitation period is three years, running from the day the person learned of the breach.',
  },
  title: { ru: 'Вход', kz: 'Кіру', en: 'Sign in' },
  lead: {
    ru: 'Войдите, чтобы продолжить работу с документами и делами.',
    kz: 'Құжаттар мен істермен жұмысты жалғастыру үшін кіріңіз.',
    en: 'Sign in to continue working with your documents and matters.',
  },
  email: { ru: 'Почта', kz: 'Пошта', en: 'Email' },
  password: { ru: 'Пароль', kz: 'Құпиясөз', en: 'Password' },
  submit: { ru: 'Войти', kz: 'Кіру', en: 'Sign in' },
  or: { ru: 'или', kz: 'немесе', en: 'or' },
  google: { ru: 'Войти через Google', kz: 'Google арқылы кіру', en: 'Continue with Google' },
  altQuestion: { ru: 'Ещё нет учётной записи?', kz: 'Тіркелгіңіз жоқ па?', en: 'No account yet?' },
  altLink: { ru: 'Зарегистрироваться', kz: 'Тіркелу', en: 'Create an account' },
  errEmailEmpty: { ru: 'Укажите почту', kz: 'Поштаны көрсетіңіз', en: 'Enter your email' },
  errEmailBad: {
    ru: 'Проверьте формат почты: имя@домен',
    kz: 'Пошта пішімін тексеріңіз: аты@домен',
    en: 'Check the email format: name@domain',
  },
  errPassEmpty: { ru: 'Введите пароль', kz: 'Құпиясөзді енгізіңіз', en: 'Enter your password' },
  errPassShort: {
    ru: 'Пароль не короче восьми знаков',
    kz: 'Құпиясөз сегіз таңбадан қысқа болмауы тиіс',
    en: 'The password must be at least eight characters',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function LoginPage() {
  const { lang } = useLang()
  const t = useT(dict)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errEmail, setErrEmail] = useState<string | null>(null)
  const [errPassword, setErrPassword] = useState<string | null>(null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = email.trim()
    const eEmail = !value ? t('errEmailEmpty') : !EMAIL_RE.test(value) ? t('errEmailBad') : null
    const ePass = !password ? t('errPassEmpty') : password.length < 8 ? t('errPassShort') : null
    setErrEmail(eEmail)
    setErrPassword(ePass)
  }

  return (
    <div className="auth">
      <aside className="auth__aside">
        <div>
          <Link to="/" className="auth__mark">
            TURA
          </Link>
          <Legal className="auth__claim">{t('claim')}</Legal>
        </div>

        <div className="auth__sample">
          <Label>{t('sampleLabel')}</Label>
          <Body className="auth__sample-text">
            {t('sampleText')} <Cite code={citeCode('ГК РК 178.1', lang)} />
          </Body>
        </div>
      </aside>

      <main className="auth__pane">
        <form className="auth__form" onSubmit={onSubmit} noValidate>
          <Link to="/" className="auth__mark auth__mark-narrow">
            TURA
          </Link>

          <div className="auth__head">
            <Display>{t('title')}</Display>
            <Body className="auth__lead">{t('lead')}</Body>
          </div>

          <div className="auth__fields">
            <Input
              label={t('email')}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errEmail ?? undefined}
            />
            <Input
              label={t('password')}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errPassword ?? undefined}
            />
          </div>

          <div className="auth__submit">
            <Button type="submit" variant="primary" size="lg" className="auth__wide">
              {t('submit')}
            </Button>
          </div>

          <div className="auth__or">
            <Caption tone="mute">{t('or')}</Caption>
          </div>

          <Button type="button" variant="secondary" size="lg" className="auth__wide">
            {t('google')}
          </Button>

          <Body className="auth__alt">
            <UIText>{t('altQuestion')} </UIText>
            <Link to="/register" className="auth__link t-ui">
              {t('altLink')}
            </Link>
          </Body>
        </form>
      </main>
    </div>
  )
}
