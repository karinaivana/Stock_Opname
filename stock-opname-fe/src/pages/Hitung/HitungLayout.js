import React from 'react'
import { Layout } from 'antd'
import { BarcodeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AppHeader from 'components/AppHeader/AppHeader'
import AppSider from 'components/AppSider/AppSider'
import { getSessionUser } from 'helpers/auth_helper'

const { Content } = Layout

const HitungLayout = ({ selectedKey = 'hitung', children }) => {
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
        subtitle="Modul Penghitungan Fisik"
        showUser
        warehouseLabel={warehouseLabel}
      />

      <Layout>
        <AppSider
          title="MENU OPERASIONAL"
          selectedKey={selectedKey}
          items={[
            {
              key: 'hitung',
              icon: <BarcodeOutlined />,
              label: 'Sesi Opname',
              onClick: () => navigate('/hitung'),
            },
          ]}
        />

        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}

export default HitungLayout
