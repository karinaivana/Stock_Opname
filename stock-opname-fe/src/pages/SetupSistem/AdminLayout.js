import React from 'react'
import { Layout } from 'antd'
import { HistoryOutlined, TeamOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AppHeader from 'components/AppHeader/AppHeader'
import AppSider from 'components/AppSider/AppSider'

const { Content } = Layout

const AdminLayout = ({ selectedKey = 'setup', children }) => {
  const navigate = useNavigate()

  return (
    <Layout style={{ minHeight: '100vh', background: '#fcf9f2' }}>
      <AppHeader title="Resto XYZ — Stock Opname" showUser />

      <Layout>
        <AppSider
          title="NAVIGASI UTAMA"
          selectedKey={selectedKey}
          items={[
            {
              key: 'setup',
              icon: <TeamOutlined />,
              label: 'Gudang & Pengguna',
              onClick: () => navigate('/admin/setup'),
            },
            {
              key: 'audit',
              icon: <HistoryOutlined />,
              label: 'Riwayat Stok',
              onClick: () => navigate('/admin/audit'),
            },
          ]}
        />

        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
