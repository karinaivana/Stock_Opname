import React from 'react'
import { Layout } from 'antd'
import {
  HistoryOutlined,
  InboxOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AppHeader from 'components/AppHeader/AppHeader'
import AppSider from 'components/AppSider/AppSider'

const { Content } = Layout

const SkuLayout = ({ selectedKey = 'sku', children }) => {
  const navigate = useNavigate()

  return (
    <Layout style={{ minHeight: '100vh', background: '#fcf9f2' }}>
      <AppHeader title="Resto XYZ — Stock Opname" showUser />

      <Layout>
        <AppSider
          title="NAVIGASI INVENTORI"
          selectedKey={selectedKey}
          items={[
            {
              key: 'sku',
              icon: <InboxOutlined />,
              label: 'SKU',
              onClick: () => navigate('/inventori/sku'),
            },
            {
              key: 'stok-awal',
              icon: <UnorderedListOutlined />,
              label: 'Stok Awal',
              onClick: () => navigate('/inventori/stok-awal'),
            },
            {
              key: 'audit',
              icon: <HistoryOutlined />,
              label: 'Riwayat Stok',
              onClick: () => navigate('/inventori/audit'),
            },
          ]}
        />

        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}

export default SkuLayout
