import { createBrowserRouter, Navigate } from 'react-router-dom'
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
 * Публичные (главная, о проекте, вход, регистрация) пререндерятся на этапе
 * сборки — им нужна индексация. Остальные живут как оболочка SPA.
 * Языковые префиксы /kk и /en сохраняются ради накопленных позиций в выдаче.
 */
export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  {
    element: <Shell />,
    children: [
      { path: '/chat', element: <ChatPage /> },
      { path: '/workspace', element: <LibraryPage /> },
      { path: '/matters', element: <MattersPage /> },
      { path: '/workspace/documents/:id', element: <DocumentPage /> },
      { path: '/contracts', element: <ContractsPage /> },
      { path: '/laws', element: <LawsPage /> },
      { path: '/analytics', element: <AnalyticsPage /> },
      { path: '/admin', element: <AdminPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
])
