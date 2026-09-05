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
const ContractsPage = lazy(() =>
  import('../features/contracts/ContractsPage').then((m) => ({ default: m.ContractsPage })),
)
const LawsPage = lazy(() => import('../features/laws/LawsPage').then((m) => ({ default: m.LawsPage })))
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

  {
    element: <Shell />,
    children: [
      { path: 'chat', element: <Deferred><ChatPage /></Deferred> },
      { path: 'workspace', element: <Deferred><LibraryPage /></Deferred> },
      { path: 'workspace/documents/:id', element: <Deferred><DocumentPage /></Deferred> },
      { path: 'matters', element: <Deferred><MattersPage /></Deferred> },
      { path: 'contracts', element: <Deferred><ContractsPage /></Deferred> },
      { path: 'laws', element: <Deferred><LawsPage /></Deferred> },
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
