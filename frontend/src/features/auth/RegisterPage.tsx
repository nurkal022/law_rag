import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Body, Button, Caption, Cite, Display, Input, Label, Legal, UIText } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
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
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function RegisterPage() {
  const t = useT(dict)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errName, setErrName] = useState<string | null>(null)
  const [errEmail, setErrEmail] = useState<string | null>(null)
  const [errPassword, setErrPassword] = useState<string | null>(null)
  const [errConfirm, setErrConfirm] = useState<string | null>(null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const mail = email.trim()
    setErrName(name.trim() ? null : t('errNameEmpty'))
    setErrEmail(!mail ? t('errEmailEmpty') : !EMAIL_RE.test(mail) ? t('errEmailBad') : null)
    setErrPassword(!password ? t('errPassEmpty') : password.length < 8 ? t('errPassShort') : null)
    setErrConfirm(
      !confirm ? t('errConfirmEmpty') : confirm !== password ? t('errConfirmDiff') : null,
    )
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
            {t('sampleText')} <Cite code="ГК РК 178.1" />
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
              label={t('name')}
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errName ?? undefined}
            />
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
              autoComplete="new-password"
              hint={t('passHint')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errPassword ?? undefined}
            />
            <Input
              label={t('confirm')}
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errConfirm ?? undefined}
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
