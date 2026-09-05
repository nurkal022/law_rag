import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { Root } from './Root'
import { Shell } from './Shell'

import { HomePage } from '../features/public/HomePage'
import { AboutPage } from '../features/public/AboutPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ChatPage } from '../features/chat/ChatPage'
import { LibraryPage } from '../features/workspace/LibraryPage'
import { MattersPage } from '../features/workspace/MattersPage'
import { DocumentPage } from '../features/workspace/DocumentPage'
import { ContractsPage } from '../features/contracts/ContractsPage'
import { LawsPage } from '../features/laws/LawsPage'
import { AnalyticsPage } from '../features/analytics/AnalyticsPage'
import { AdminPage } from '../features/admin/AdminPage'

/**
 * Маршруты TURA.
 *
 * Публичные (главная, о проекте, вход, регистрация) идут без рельса и
 * пререндерятся при сборке — им нужна индексация. Остальные живут под
 * оболочкой.
 */
const pages: RouteObject[] = [
  { index: true, element: <HomePage /> },
  { path: 'about', element: <AboutPage /> },
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },

  {
    element: <Shell />,
    children: [
      { path: 'chat', element: <ChatPage /> },
      { path: 'workspace', element: <LibraryPage /> },
      { path: 'workspace/documents/:id', element: <DocumentPage /> },
      { path: 'matters', element: <MattersPage /> },
      { path: 'contracts', element: <ContractsPage /> },
      { path: 'laws', element: <LawsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'admin', element: <AdminPage /> },
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
