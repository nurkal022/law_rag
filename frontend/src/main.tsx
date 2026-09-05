import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import './styles/tokens.css'
import './styles/base.css'
import './shared/ui/ui.css'

import { LangProvider } from './i18n'
import { ToastHost } from './shared/ui'
import { router } from './app/routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <ToastHost>
        <RouterProvider router={router} />
      </ToastHost>
    </LangProvider>
  </StrictMode>,
)
