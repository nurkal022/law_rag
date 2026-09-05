import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from '../../shared/nav'
import {
  Body,
  Button,
  Caption,
  Cite,
  Display,
  Input,
  Label,
  Legal,
  Loading,
  UIText,
} from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import './auth.css'
import './auth.motion.css'

/**
 * Регистрация.
 *
 * Поведение то же, что у входа: кнопка показывает ожидание, ошибки полей
 * раскрываются, после проверки открывается консультант.
 */

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
  title: { ru: 'Регистрация', kz: 'Тіркелу', en: 'Create an account' },
  lead: {
    ru: 'Учётная запись хранит вашу переписку, документы и дела.',
    kz: 'Тіркелгі сіздің хат алмасуыңызды, құжаттарыңыз бен істеріңізді сақтайды.',
    en: 'An account keeps your conversations, documents and matters.',
  },
  name: { ru: 'Имя', kz: 'Аты-жөні', en: 'Name' },
  email: { ru: 'Почта', kz: 'Пошта', en: 'Email' },
  password: { ru: 'Пароль', kz: 'Құпиясөз', en: 'Password' },
  confirm: { ru: 'Пароль ещё раз', kz: 'Құпиясөзді қайталаңыз', en: 'Repeat password' },
  passHint: {
    ru: 'Не короче восьми знаков',
    kz: 'Сегіз таңбадан қысқа емес',
    en: 'At least eight characters',
  },
  submit: { ru: 'Создать учётную запись', kz: 'Тіркелгі жасау', en: 'Create account' },
  or: { ru: 'или', kz: 'немесе', en: 'or' },
  google: {
    ru: 'Зарегистрироваться через Google',
    kz: 'Google арқылы тіркелу',
    en: 'Continue with Google',
  },
  guest: {
    ru: 'Без регистрации доступно пять бесплатных вопросов — попробуйте прежде, чем заводить учётную запись.',
    kz: 'Тіркелмей-ақ бес тегін сұрақ қоюға болады — тіркелгі жасамас бұрын байқап көріңіз.',
    en: 'Five free questions are available without an account — try it before signing up.',
  },
  guestLink: { ru: 'Задать вопрос без входа', kz: 'Кірмей сұрақ қою', en: 'Ask without signing in' },
  altQuestion: { ru: 'Уже есть учётная запись?', kz: 'Тіркелгіңіз бар ма?', en: 'Already have an account?' },
  altLink: { ru: 'Войти', kz: 'Кіру', en: 'Sign in' },
  errNameEmpty: { ru: 'Укажите имя', kz: 'Атыңызды көрсетіңіз', en: 'Enter your name' },
  errEmailEmpty: { ru: 'Укажите почту', kz: 'Поштаны көрсетіңіз', en: 'Enter your email' },
  errEmailBad: {
    ru: 'Проверьте формат почты: имя@домен',
    kz: 'Пошта пішімін тексеріңіз: аты@домен',
    en: 'Check the email format: name@domain',
  },
  errPassEmpty: { ru: 'Введите пароль', kz: 'Құпиясөзді енгізіңіз', en: 'Enter a password' },
  errPassShort: {
    ru: 'Пароль не короче восьми знаков',
    kz: 'Құпиясөз сегіз таңбадан қысқа болмауы тиіс',
    en: 'The password must be at least eight characters',
  },
  errConfirmEmpty: {
    ru: 'Повторите пароль',
    kz: 'Құпиясөзді қайталаңыз',
    en: 'Repeat the password',
  },
  errConfirmDiff: { ru: 'Пароли не совпадают', kz: 'Құпиясөздер сәйкес келмейді', en: 'The passwords do not match' },
  checking: { ru: 'Проверяем…', kz: 'Тексерудеміз…', en: 'Checking…' },
  waitNote: {
    ru: 'Создаём учётную запись и открываем консультанта',
    kz: 'Тіркелгі жасап, кеңесшіні ашып жатырмыз',
    en: 'Creating the account and opening the assistant',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Ожидание перед переходом: столько система тратит на проверку данных. */
const SUBMIT_MS = 900

export function RegisterPage() {
  const { lang } = useLang()
  const t = useT(dict)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errName, setErrName] = useState<string | null>(null)
  const [errEmail, setErrEmail] = useState<string | null>(null)
  const [errPassword, setErrPassword] = useState<string | null>(null)
  const [errConfirm, setErrConfirm] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  /** Номер попытки: по нему ошибка перерисовывается и раскрытие играет заново. */
  const [attempt, setAttempt] = useState(0)
  const navigate = useNavigate()
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  function unfold(text: string | null): ReactNode {
    if (!text) return undefined
    return (
      <span className="unfold" key={attempt}>
        {text}
      </span>
    )
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const mail = email.trim()
    const eName = name.trim() ? null : t('errNameEmpty')
    const eMail = !mail ? t('errEmailEmpty') : !EMAIL_RE.test(mail) ? t('errEmailBad') : null
    const ePass = !password ? t('errPassEmpty') : password.length < 8 ? t('errPassShort') : null
    const eConf = !confirm
      ? t('errConfirmEmpty')
      : confirm !== password
        ? t('errConfirmDiff')
        : null
    setErrName(eName)
    setErrEmail(eMail)
    setErrPassword(ePass)
    setErrConfirm(eConf)
    setAttempt((n) => n + 1)
    if (eName || eMail || ePass || eConf) return

    setPending(true)
    timer.current = window.setTimeout(() => {
      navigate(withLang('/chat', lang))
    }, SUBMIT_MS)
  }

  return (
    <div className="auth">
      <aside className="auth__aside enter">
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
        <form
          className="auth__form enter"
          onSubmit={onSubmit}
          noValidate
          style={{ animationDelay: 'calc(var(--stagger) * 1)' }}
        >
          <Link to="/" className="auth__mark auth__mark-narrow">
            TURA
          </Link>

          <div className="auth__head">
            <Display>{t('title')}</Display>
            <Body className="auth__lead">{t('lead')}</Body>
          </div>

          <div className="auth__fields">
            <Input
              label={t('name')}
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={unfold(errName)}
              disabled={pending}
            />
            <Input
              label={t('email')}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={unfold(errEmail)}
              disabled={pending}
            />
            <Input
              label={t('password')}
              type="password"
              name="password"
              autoComplete="new-password"
              hint={t('passHint')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={unfold(errPassword)}
              disabled={pending}
            />
            <Input
              label={t('confirm')}
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={unfold(errConfirm)}
              disabled={pending}
            />
          </div>

          <div className="auth__submit">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="auth__wide"
              disabled={pending}
              aria-busy={pending || undefined}
            >
              <span className="swap" key={pending ? 'wait' : 'idle'}>
                {pending ? t('checking') : t('submit')}
              </span>
            </Button>
            {pending ? (
              <div className="auth__wait unfold">
                <Loading label={t('checking')} />
                <Caption tone="mute" className="auth__wait-note">
                  {t('waitNote')}
                </Caption>
              </div>
            ) : null}
          </div>

          <div className="auth__or">
            <Caption tone="mute">{t('or')}</Caption>
          </div>

          <Button type="button" variant="secondary" size="lg" className="auth__wide" disabled={pending}>
            {t('google')}
          </Button>

          <Body className="auth__note">
            <UIText tone="mute">{t('guest')} </UIText>
            <Link to="/chat" className="auth__link t-ui">
              {t('guestLink')}
            </Link>
          </Body>

          <Body className="auth__alt">
            <UIText>{t('altQuestion')} </UIText>
            <Link to="/login" className="auth__link t-ui">
              {t('altLink')}
            </Link>
          </Body>
        </form>
      </main>
    </div>
  )
}
