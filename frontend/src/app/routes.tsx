import { Suspense, lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { Root } from './Root'
import { Shell } from './Shell'
import { Loading } from '../shared/ui'

/**
 * Маршруты TURA.
 *
 * Публичные страницы (главная, о проекте, вход, регистрация) загружаются
 * сразу: это первое, что видит человек, и именно они пререндерятся при сборке.
 * Рабочие экраны подгружаются по требованию — иначе весь продукт приезжает
 * одним куском ради страницы, на которую посетитель может и не зайти.
 */
import { HomePage } from '../features/public/HomePage'
import { AboutPage } from '../features/public/AboutPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'

const ChatPage = lazy(() => import('../features/chat/ChatPage').then((m) => ({ default: m.ChatPage })))
const LibraryPage = lazy(() =>
  import('../features/workspace/LibraryPage').then((m) => ({ default: m.LibraryPage })),
)
const MattersPage = lazy(() =>
  import('../features/workspace/MattersPage').then((m) => ({ default: m.MattersPage })),
)
const DocumentPage = lazy(() =>
  import('../features/workspace/DocumentPage').then((m) => ({ default: m.DocumentPage })),
)
const CatalogPage = lazy(() =>
  import('../features/contracts/CatalogPage').then((m) => ({ default: m.CatalogPage })),
)
const ContractBuilderPage = lazy(() =>
  import('../features/contracts/BuilderPage').then((m) => ({ default: m.BuilderPage })),
)
const ContractDocumentPage = lazy(() =>
  import('../features/contracts/DocumentPage').then((m) => ({ default: m.DocumentPage })),
)
const MyContractsPage = lazy(() =>
  import('../features/contracts/MyContractsPage').then((m) => ({ default: m.MyContractsPage })),
)
const LawsRegistryPage = lazy(() =>
  import('../features/laws/RegistryPage').then((m) => ({ default: m.RegistryPage })),
)
const LawWizardPage = lazy(() =>
  import('../features/laws/WizardPage').then((m) => ({ default: m.WizardPage })),
)
const LawDocumentPage = lazy(() =>
  import('../features/laws/DocumentPage').then((m) => ({ default: m.DocumentPage })),
)
const AnalyticsPage = lazy(() =>
  import('../features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)
const AdminPage = lazy(() => import('../features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))

/** Пока подгружается экран — тонкая линия набора, а не пустота и не спиннер. */
function Deferred({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="page">
          <Loading />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

const pages: RouteObject[] = [
  { index: true, element: <HomePage /> },
  { path: 'about', element: <AboutPage /> },
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },

  // Консультант живёт вне оболочки: это отдельная полноэкранная страница,
  // разделы продукта у неё в подвале боковой колонки.
  { path: 'chat', element: <Deferred><ChatPage /></Deferred> },
  { path: 'chat/:id', element: <Deferred><ChatPage /></Deferred> },

  {
    element: <Shell />,
    children: [
      { path: 'workspace', element: <Deferred><LibraryPage /></Deferred> },
      { path: 'workspace/documents/:id', element: <Deferred><DocumentPage /></Deferred> },
      { path: 'matters', element: <Deferred><MattersPage /></Deferred> },
      // Порядок важен: 'new/:type' и 'mine' обязаны стоять до ':id',
      // иначе конструктор откроется как документ с идентификатором «new».
      { path: 'contracts', element: <Deferred><CatalogPage /></Deferred> },
      { path: 'contracts/mine', element: <Deferred><MyContractsPage /></Deferred> },
      { path: 'contracts/new/:type', element: <Deferred><ContractBuilderPage /></Deferred> },
      { path: 'contracts/:id', element: <Deferred><ContractDocumentPage /></Deferred> },
      // Тот же порядок, что у договоров: 'new' обязан стоять до ':id',
      // иначе мастер откроется как документ с идентификатором «new».
      { path: 'laws', element: <Deferred><LawsRegistryPage /></Deferred> },
      { path: 'laws/new', element: <Deferred><LawWizardPage /></Deferred> },
      { path: 'laws/:id', element: <Deferred><LawDocumentPage /></Deferred> },
      { path: 'analytics', element: <Deferred><AnalyticsPage /></Deferred> },
      { path: 'admin', element: <Deferred><AdminPage /></Deferred> },
    ],
  },
]

/**
 * Каждая страница существует на трёх языках: русский без префикса, казахский
 * под /kk, английский под /en. Структура адресов повторяет прежнюю — иначе
 * теряются накопленные позиции в поиске.
 */
export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', children: pages },
      { path: '/kk', children: pages },
      { path: '/en', children: pages },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
