import React from 'react'
import { Navigate } from 'react-router-dom'
import Login from 'pages/Authentication/Login'
import SetupSistem from 'pages/SetupSistem'
import SkuList from 'pages/Sku'
import SkuForm from 'pages/Sku/SkuForm'
import StokAwal from 'pages/StokAwal'
import SesiList from 'pages/Sesi'
import CreateSession from 'pages/Sesi/CreateSession'
import SessionDetail from 'pages/Sesi/SessionDetail'
import TinjauSelisih from 'pages/Sesi/TinjauSelisih'
import HitungPage from 'pages/Hitung'
import RiwayatStok from 'pages/RiwayatStok'
import { getHomePath, ROLES } from 'constants/roles'
import { getSessionUser } from 'helpers/auth_helper'

const HomeRedirect = () => {
  const user = getSessionUser()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={getHomePath(user.role)} replace />
}

const publicRoutes = [{ path: '/login', component: <Login /> }]

const authProtectedRoutes = [
  {
    path: '/admin/setup',
    component: <SetupSistem />,
    role: [ROLES.SUPER_ADMIN],
  },
  {
    path: '/admin/audit',
    component: <RiwayatStok />,
    role: [ROLES.SUPER_ADMIN],
  },
  {
    path: '/inventori/sku',
    component: <SkuList />,
    role: [ROLES.INVENTORY_ADMIN],
  },
  {
    path: '/inventori/sku/baru',
    component: <SkuForm />,
    role: [ROLES.INVENTORY_ADMIN],
  },
  {
    path: '/inventori/sku/:id',
    component: <SkuForm />,
    role: [ROLES.INVENTORY_ADMIN],
  },
  {
    path: '/inventori/stok-awal',
    component: <StokAwal />,
    role: [ROLES.INVENTORY_ADMIN],
  },
  {
    path: '/inventori/audit',
    component: <RiwayatStok />,
    role: [ROLES.INVENTORY_ADMIN],
  },
  {
    path: '/sesi',
    component: <SesiList />,
    role: [ROLES.WAREHOUSE_MANAGER],
  },
  {
    path: '/sesi/baru',
    component: <CreateSession />,
    role: [ROLES.WAREHOUSE_MANAGER],
  },
  {
    path: '/sesi/tinjau',
    component: <TinjauSelisih />,
    role: [ROLES.WAREHOUSE_MANAGER],
  },
  {
    path: '/sesi/audit',
    component: <RiwayatStok />,
    role: [ROLES.WAREHOUSE_MANAGER],
  },
  {
    path: '/sesi/:id',
    component: <SessionDetail />,
    role: [ROLES.WAREHOUSE_MANAGER],
  },
  {
    path: '/hitung',
    component: <HitungPage />,
    role: [ROLES.WAREHOUSE_STAFF],
  },
  {
    path: '/',
    component: <HomeRedirect />,
  },
]

export { publicRoutes, authProtectedRoutes }
