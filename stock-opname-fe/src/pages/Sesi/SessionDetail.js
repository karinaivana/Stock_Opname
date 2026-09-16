import React from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, QrcodeOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { formatDateTime } from 'helpers/util'
import SesiLayout from './SesiLayout'
import { useSession } from 'hooks/useSessions'

const { Title, Text } = Typography

const STATUS_COLOR = {
  COUNTING: 'processing',
  SUBMITTED: 'warning',
  APPROVED: 'blue',
  RECONCILING: 'blue',
  COMPLETED: 'success',
  REJECTED: 'error',
  FAILED: 'error',
}

const formatQty = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return parsed.toLocaleString('id-ID', {
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 1,
    maximumFractionDigits: 3,
  })
}

const SessionDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: session, isLoading, isFetching } = useSession(id)

  const sesiColumns = [
    {
      title: 'Stock Keeping Unit (SKU)',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku) => (
        <Space size={6}>
          <QrcodeOutlined style={{ color: '#625d5b' }} />
          <Text code>{sku}</Text>
        </Space>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Base Unit',
      dataIndex: 'base_uom',
      key: 'base_uom',
    },
    {
      title: 'Expected Quantity',
      dataIndex: 'expected_qty',
      key: 'expected_qty',
      align: 'right',
      render: (qty, row) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatQty(qty)} {row.base_uom}
        </Text>
      ),
    },
    {
      title: 'Counted Quantity',
      dataIndex: 'counted_qty',
      key: 'counted_qty',
      align: 'right',
      render: (qty, row) =>
        qty == null ? (
          <Text type="secondary">Belum diisi</Text>
        ) : (
          <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatQty(qty)} {row.base_uom}
          </Text>
        ),
    },
    {
      title: 'Calculation Type',
      key: 'count_types',
      render: (_, row) =>
        (row.count_types || [])
          .map((ct) => `${ct.uom}×${formatQty(ct.factor_to_base)}`)
          .join(', ') || '-',
    },
  ]

  return (
    <SesiLayout selectedKey="sesi">
      <Spin spinning={isLoading || isFetching}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/sesi')}
              style={{
                padding: 0,
                height: 'auto',
                marginBottom: 8,
                color: '#625d5b',
              }}
            >
              Kembali
            </Button>
            <Flex
              justify="space-between"
              align="center"
              wrap="wrap"
              gap="middle"
            >
              <Title level={2} style={{ margin: 0 }}>
                {session?.code || 'Sesi'} · ({session?.warehouse?.name || '-'})
              </Title>
              <Tag
                color={STATUS_COLOR[session?.status] || 'default'}
                style={{
                  borderRadius: 8,
                  margin: 0,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                {session?.status || '-'}
              </Tag>
            </Flex>
          </div>

          {session?.status === 'COUNTING' ? (
            <Alert
              type="info"
              showIcon
              message="Stok resmi tidak berubah sampai manajer menyetujui"
            />
          ) : null}

          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            items={[
              {
                key: 'snapshot',
                label: 'Snapshot Time',
                children: formatDateTime(session?.snapshot_at),
              },
              {
                key: 'created_by',
                label: 'Created By',
                children: session?.created_by || '-',
              },
              {
                key: 'submitted_by',
                label: 'Submitted By',
                children: session?.submitted_by || '-',
              },
              {
                key: 'approved_by',
                label: 'Approved By',
                children: session?.approved_by || '-',
              },
              {
                key: 'items',
                label: 'Total Items',
                children: session?.item_count ?? session?.items?.length ?? 0,
              },
              {
                key: 'reject',
                label: 'Reject Reason',
                children: session?.reject_reason || '-',
              },
            ]}
          />

          <Table
            rowKey={(row) => row.product_id}
            columns={sesiColumns}
            dataSource={session?.items || []}
            pagination={{
              defaultPageSize: 10,
              pageSizeOptions: [10, 20, 50],
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} dari ${total}`,
            }}
            locale={{ emptyText: 'Sesi tidak memiliki item.' }}
          />
        </Space>
      </Spin>
    </SesiLayout>
  )
}

export default SessionDetail
