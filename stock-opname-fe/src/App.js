import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import idID from 'antd/locale/id_ID'
import { authProtectedRoutes, publicRoutes } from 'routes'
import Authmiddleware from 'routes/route'
import { antdTheme } from 'theme/antdTheme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={idID} theme={antdTheme}>
        <AntApp>
          <Routes>
            {publicRoutes.map((route, idx) => (
              <Route
                path={route.path}
                element={route.component}
                key={`public-${idx}`}
              />
            ))}

            {authProtectedRoutes.map((route, idx) => (
              <Route
                path={route.path}
                element={
                  <Authmiddleware route={route}>
                    {route.component}
                  </Authmiddleware>
                }
                key={`auth-${idx}`}
              />
            ))}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App
