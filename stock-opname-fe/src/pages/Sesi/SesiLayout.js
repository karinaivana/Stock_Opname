import React from 'react'
import { Layout } from 'antd'
import {
  DiffOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AppHeader from 'components/AppHeader/AppHeader'
import AppSider from 'components/AppSider/AppSider'
import { getSessionUser } from 'helpers/auth_helper'

const { Content } = Layout

const SesiLayout = ({ selectedKey = 'sesi', children }) => {
  const navigate = useNavigate()
  const user = getSessionUser()
  const warehouseLabel = user?.warehouse
    ? `${user.warehouse.name || 'Gudang'}${
        user.warehouse.code ? ` (${user.warehouse.code})` : ''
      }`
    : null

  return (
    <Layout style={{ minHeight: '100vh', background: '#fcf9f2' }}>
      <AppHeader
        title="Resto XYZ — Stock Opname"
        subtitle="Modul Manajer Gudang"
        showUser
        warehouseLabel={warehouseLabel}
      />

      <Layout>
        <AppSider
          title="NAVIGASI MANAJER"
          selectedKey={selectedKey}
          items={[
            {
              key: 'sesi',
              icon: <UnorderedListOutlined />,
              label: 'Sesi Opname',
              onClick: () => navigate('/sesi'),
            },
            {
              key: 'tinjau',
              icon: <DiffOutlined />,
              label: 'Tinjau Selisih',
              onClick: () => navigate('/sesi/tinjau'),
            },
            {
              key: 'audit',
              icon: <HistoryOutlined />,
              label: 'Riwayat Stok',
              onClick: () => navigate('/sesi/audit'),
            },
          ]}
        />

        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}

export default SesiLayout
