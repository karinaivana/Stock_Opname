import React, { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Flex,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { getRoleLabel, ROLES } from 'constants/roles'
import { getSessionUser } from 'helpers/auth_helper'
import { useWarehouses } from 'hooks/useWarehouses'
import { useUsers } from 'hooks/useUsers'
import AdminLayout from './AdminLayout'
import WarehouseModal from './WarehouseModal'
import UserModal from './UserModal'

const { Title, Text, Paragraph } = Typography

const EMPTY_LIST = []
const PAGE_SIZE = 10

const WAREHOUSE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'AKTIF', label: 'AKTIF' },
  { value: 'NONAKTIF', label: 'NONAKTIF' },
]

const statusTag = (active) =>
  active !== false ? (
    <Tag color="success">AKTIF</Tag>
  ) : (
    <Tag>NONAKTIF</Tag>
  )

const roleTagColor = {
  [ROLES.WAREHOUSE_STAFF]: 'blue',
  [ROLES.WAREHOUSE_MANAGER]: 'gold',
  [ROLES.INVENTORY_ADMIN]: 'default',
  [ROLES.SUPER_ADMIN]: 'red',
}

const SetupSistem = () => {
  const currentUser = getSessionUser()

  const [activeTab, setActiveTab] = useState('gudang')
  const [whSearch, setWhSearch] = useState('')
  const [whSearchInput, setWhSearchInput] = useState('')
  const [whStatus, setWhStatus] = useState('ALL')
  const [whPage, setWhPage] = useState(1)

  const [userSearch, setUserSearch] = useState('')
  const [userSearchInput, setUserSearchInput] = useState('')
  const [userRole, setUserRole] = useState('ALL')
  const [userPage, setUserPage] = useState(1)

  const [whModalOpen, setWhModalOpen] = useState(false)
  const [editingWh, setEditingWh] = useState(null)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setWhSearch(whSearchInput.trim())
      setWhPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [whSearchInput])

  useEffect(() => {
    const timer = setTimeout(() => {
      setUserSearch(userSearchInput.trim())
      setUserPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearchInput])

  const {
    data: warehousesData,
    isLoading: loadingWh,
    isFetching: fetchingWh,
  } = useWarehouses({
    page: whPage,
    limit: PAGE_SIZE,
    q: whSearch,
    status: whStatus,
  })

  const {
    data: usersData,
    isLoading: loadingUsers,
    isFetching: fetchingUsers,
  } = useUsers({
    page: userPage,
    limit: PAGE_SIZE,
    q: userSearch,
    role: userRole,
  })

  const { data: warehouseOptionsData } = useWarehouses({
    page: 1,
    limit: 100,
    status: 'AKTIF',
    enabled: userModalOpen,
  })

  const warehouses = warehousesData?.items ?? EMPTY_LIST
  const warehouseTotal = warehousesData?.total ?? 0
  const users = usersData?.items ?? EMPTY_LIST
  const userTotal = usersData?.total ?? 0
  const warehouseOptions = warehouseOptionsData?.items ?? EMPTY_LIST

  const warehouseColumns = [
    {
      title: 'Kode',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text code>{code}</Text>,
    },
    {
      title: 'Nama Gudang',
      key: 'name',
      render: (_, row) => (
        <div>
          <Text strong>{row.name}</Text>
          {row.description ? (
            <div>
              <Text type="secondary">{row.description}</Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: statusTag,
    },
    {
      title: 'Total Pengguna',
      key: 'users',
      render: (_, row) => {
        const count = row.user_count ?? 0
        if (!count) {
          return <Text type="secondary">0 Pengguna</Text>
        }
        return (
          <Text>
            <Text strong>{count} Pengguna</Text>
            {row.users_preview ? ` terdaftar (${row.users_preview})` : ''}
          </Text>
        )
      },
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => {
            setEditingWh(row)
            setWhModalOpen(true)
          }}
        >
          Ubah
        </Button>
      ),
    },
  ]

  const userColumns = [
    {
      title: 'Nama',
      dataIndex: 'name',
      key: 'name',
      render: (name, row) => (
        <Space>
          <Text strong>{name}</Text>
          {currentUser?.email && row.email === currentUser.email ? (
            <Tag color="red">Anda</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) => <Text type="secondary">{email}</Text>,
    },
    {
      title: 'Peran Pengguna',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={roleTagColor[role] || 'default'}>
          {getRoleLabel(role).toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Gudang Penugasan Pengguna',
      key: 'warehouse',
      render: (_, row) => {
        if (
          row.role === ROLES.SUPER_ADMIN ||
          row.role === ROLES.INVENTORY_ADMIN
        ) {
          return (
            <div>
              <Text strong>Semua gudang</Text>
              <div>
                <Text type="secondary">
                  {row.role === ROLES.SUPER_ADMIN
                    ? 'Akses Administratif'
                    : 'Akses Global ke Semua Katalog'}
                </Text>
              </div>
            </div>
          )
        }
        return (
          <div>
            <Text strong>{row.warehouse_name || '-'}</Text>
            <div>
              <Text type="secondary">Terkunci 1 gudang</Text>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: statusTag,
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => {
            setEditingUser(row)
            setUserModalOpen(true)
          }}
        >
          Ubah
        </Button>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'gudang',
      label: (
        <Space>
          Gudang
          <Badge count={warehouseTotal} showZero color="#bc0006" overflowCount={999} />
        </Space>
      ),
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Flex wrap="wrap" gap="small">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari kode atau nama gudang..."
              value={whSearchInput}
              onChange={(e) => setWhSearchInput(e.target.value)}
              style={{ width: 280 }}
            />
            <Select
              value={whStatus}
              onChange={(value) => {
                setWhStatus(value)
                setWhPage(1)
              }}
              style={{ width: 180 }}
              options={WAREHOUSE_STATUS_OPTIONS}
            />
          </Flex>
          <Table
            rowKey={(row) => row.id || row.code}
            loading={loadingWh || fetchingWh}
            columns={warehouseColumns}
            dataSource={warehouses}
            pagination={{
              current: whPage,
              pageSize: PAGE_SIZE,
              total: warehouseTotal,
              showSizeChanger: false,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} dari ${total}`,
              onChange: (page) => setWhPage(page),
            }}
          />
        </Space>
      ),
    },
    {
      key: 'pengguna',
      label: (
        <Space>
          <TeamOutlined />
          Pengguna
          <Badge count={userTotal} showZero color="#bc0006" overflowCount={999} />
        </Space>
      ),
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Flex wrap="wrap" gap="small">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari nama atau email pengguna..."
              value={userSearchInput}
              onChange={(e) => setUserSearchInput(e.target.value)}
              style={{ width: 280 }}
            />
            <Select
              value={userRole}
              onChange={(value) => {
                setUserRole(value)
                setUserPage(1)
              }}
              style={{ width: 200 }}
              options={[
                { value: 'ALL', label: 'Semua Peran' },
                ...Object.values(ROLES).map((role) => ({
                  value: role,
                  label: getRoleLabel(role),
                })),
              ]}
            />
          </Flex>
          <Table
            rowKey={(row) => row.id || row.email}
            loading={loadingUsers || fetchingUsers}
            columns={userColumns}
            dataSource={users}
            pagination={{
              current: userPage,
              pageSize: PAGE_SIZE,
              total: userTotal,
              showSizeChanger: false,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} dari ${total}`,
              onChange: (page) => setUserPage(page),
            }}
          />
        </Space>
      ),
    },
  ]

  return (
    <AdminLayout selectedKey="setup">
      <Flex
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="middle"
        style={{ marginBottom: 16 }}
      >
        <div>
          <Title level={2}>
            Setup Sistem
          </Title>
        </div>

        {activeTab === 'gudang' ? (
          <Button
            type="primary"
            onClick={() => {
              setEditingWh(null)
              setWhModalOpen(true)
            }}
          >
            Buat Gudang Baru
          </Button>
        ) : (
          <Button
            type="primary"
            onClick={() => {
              setEditingUser(null)
              setUserModalOpen(true)
            }}
          >
            Buat Pengguna Baru
          </Button>
        )}
      </Flex>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <WarehouseModal
        open={whModalOpen}
        warehouse={editingWh}
        onClose={() => {
          setWhModalOpen(false)
          setEditingWh(null)
        }}
      />
      <UserModal
        open={userModalOpen}
        user={editingUser}
        warehouses={warehouseOptions}
        onClose={() => {
          setUserModalOpen(false)
          setEditingUser(null)
        }}
      />
    </AdminLayout>
  )
}

export default SetupSistem
