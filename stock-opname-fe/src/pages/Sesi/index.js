import React from 'react'
import {
  Alert,
  App,
  Button,
  Flex,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { formatDateTime } from 'helpers/util'
import SesiLayout from './SesiLayout'
import { useSessions } from 'hooks/useSessions'

const { Title, Text } = Typography

const EMPTY_LIST = []

const STATUS_COLOR = {
  COUNTING: 'processing',
  SUBMITTED: 'warning',
  APPROVED: 'blue',
  RECONCILING: 'blue',
  COMPLETED: 'success',
  REJECTED: 'error',
  FAILED: 'error',
}

const SesiList = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()

  const { data, isLoading, isFetching } = useSessions()

  const sessions = data?.items ?? EMPTY_LIST
  const hasActiveSession = Boolean(data?.has_active_session)
  const warehouse = data?.warehouse

  const warehouseLabel = warehouse
    ? `${warehouse.name}${warehouse.code ? ` (${warehouse.code})` : ''}`
    : 'gudang ini'

  const handleStartCreate = () => {
    if (hasActiveSession) {
      message.warning(
        `Tidak bisa membuat sesi baru. Masih ada sesi aktif (${data?.active_session?.code}).`
      )
      return
    }
    navigate('/sesi/baru')
  }

  const sessionColumns = [
    {
      title: 'ID Sesi',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text code>{code}</Text>,
    },
    {
      title: 'Waktu Sesi Opname',
      dataIndex: 'snapshot_at',
      key: 'snapshot_at',
      render: formatDateTime,
    },
    {
      title: 'Dibuat Oleh',
      dataIndex: 'created_by',
      key: 'created_by',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={STATUS_COLOR[status] || 'default'} style={{ borderRadius: 8 }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Jumlah Item',
      dataIndex: 'item_count',
      key: 'item_count',
      align: 'right',
      render: (count) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, row) => (
        <Button
          size="small"
          onClick={() =>
            navigate(
              row.status === 'SUBMITTED' ? '/sesi/tinjau' : `/sesi/${row.id}`
            )
          }
        >
          {row.status === 'SUBMITTED' ? 'Tinjau' : 'Lihat'}
        </Button>
      ),
    },
  ]

  return (
    <SesiLayout selectedKey="sesi">
      <Flex
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="middle"
        style={{ marginBottom: 16 }}
      >
        <div>
          <Title level={2}>Sesi Stock Opname</Title>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          disabled={hasActiveSession}
          onClick={handleStartCreate}
        >
          Buat Sesi Baru
        </Button>
      </Flex>

      {hasActiveSession ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Sesi baru tidak bisa dibuat sampai sesi stock opname (${data?.active_session?.code}) selesai atau ditolak.`}
        />
      ) : null}

      <Spin spinning={isLoading || isFetching}>
        <Table
          rowKey={(row) => row.id}
          columns={sessionColumns}
          dataSource={sessions}
          pagination={false}
          locale={{
            emptyText: 'Belum ada sesi stock opname untuk gudang ini.',
          }}
          title={() => (
            <div>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>
                RIWAYAT SESI
              </Text>
              <Title level={5} style={{ margin: 0 }}>
                {warehouseLabel}
              </Title>
            </div>
          )}
        />
      </Spin>
    </SesiLayout>
  )
}

export default SesiList
