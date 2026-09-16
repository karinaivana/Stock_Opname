import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Empty,
  Flex,
  Input,
  Modal,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleFilled,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  QrcodeOutlined,
} from '@ant-design/icons'
import { formatDateTime } from 'helpers/util'
import SesiLayout from './SesiLayout'
import {
  useApproveSessionMutation,
  useRejectSessionMutation,
  useSessionVariances,
  useSessions,
} from 'hooks/useSessions'

const { Title, Text } = Typography
const { TextArea } = Input

const EMPTY_LIST = []

const formatQty = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return parsed.toLocaleString('id-ID', {
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 1,
    maximumFractionDigits: 3,
  })
}

const formatSignedQty = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  const formatted = formatQty(Math.abs(parsed))
  if (parsed > 0) return `+${formatted}`
  if (parsed < 0) return `−${formatted}`
  return formatted
}

const varianceColor = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed === 0) return '#57534e'
  if (parsed < 0) return '#7f1d1d'
  return '#b45309'
}

const buildDetailText = (row) => {
  if (row.detail_text) return row.detail_text
  const counts = row.counts || []
  if ((row.count_types || []).length <= 1 || counts.length === 0) return '—'
  return counts.map((item) => `${formatQty(item.qty)} ${item.uom}`).join(' + ')
}

const buildApproveSummary = (items = []) =>
  items
    .filter((item) => Number(item.variance) !== 0)
    .slice(0, 6)
    .map((item) => ({
      key: item.product_id || item.sku,
      name: item.name,
      expected: formatQty(item.expected_qty),
      counted: formatQty(item.counted_qty),
      uom: item.base_uom,
    }))

const TinjauSelisih = () => {
  const { message } = App.useApp()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    isFetching: sessionsFetching,
  } = useSessions()

  const reviewSession = useMemo(() => {
    const items = sessionsData?.items || EMPTY_LIST
    const submitted = items.find((item) => item.status === 'SUBMITTED')
    if (submitted) return submitted

    const active = sessionsData?.active_session
    if (
      active &&
      ['SUBMITTED', 'APPROVED', 'RECONCILING'].includes(active.status)
    ) {
      return active
    }

    return items.find((item) =>
      ['APPROVED', 'RECONCILING', 'COMPLETED', 'REJECTED'].includes(item.status)
    )
  }, [sessionsData])

  const sessionId = reviewSession?.id || null
  const {
    data: varianceData,
    isLoading: varianceLoading,
    isFetching: varianceFetching,
  } = useSessionVariances(sessionId)

  const approveMutation = useApproveSessionMutation()
  const rejectMutation = useRejectSessionMutation()

  const items = varianceData?.items ?? EMPTY_LIST
  const summary = varianceData?.summary
  const canDecide = varianceData?.status === 'SUBMITTED'

  const filteredItems = useMemo(() => {
    if (filter === 'zero') {
      return items.filter((item) => Number(item.variance) === 0)
    }
    if (filter === 'variance') {
      return items.filter((item) => Number(item.variance) !== 0)
    }
    return items
  }, [items, filter])

  useEffect(() => {
    setPage(1)
  }, [filter, sessionId])

  const warehouseLabel = varianceData?.warehouse
    ? `${varianceData.warehouse.name}${
        varianceData.warehouse.code
          ? ` (${varianceData.warehouse.code})`
          : ''
      }`
    : sessionsData?.warehouse?.name || 'gudang ini'

  const approveSummary = useMemo(() => buildApproveSummary(items), [items])

  const loading =
    sessionsLoading ||
    sessionsFetching ||
    (Boolean(sessionId) && (varianceLoading || varianceFetching))

  const handleApprove = async () => {
    try {
      const result = await approveMutation.mutateAsync(sessionId)
      setApproveOpen(false)
      if (result?.already_approved) {
        message.info('Sesi sudah disetujui sebelumnya. Job rekonsiliasi tidak digandakan.')
      } else {
        message.success(
          'Sesi Stock Opname telah disetujui'
        )
      }
    } catch (error) {
      message.error(error.message || 'Gagal menyetujui sesi')
    }
  }

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({
        sessionId,
        reason: rejectReason.trim() || undefined,
      })
      setRejectOpen(false)
      setRejectReason('')
      message.success('Sesi ditolak. On-hand tidak berubah.')
    } catch (error) {
      message.error(error.message || 'Gagal menolak sesi')
    }
  }

  const columns = [
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
      title: 'Nama',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Satuan',
      dataIndex: 'base_uom',
      key: 'base_uom',
      width: 100,
    },
    {
      title: 'Total Ekspektasi',
      dataIndex: 'expected_qty',
      key: 'expected_qty',
      align: 'right',
      render: (qty) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatQty(qty)}
        </Text>
      ),
    },
    {
      title: 'Total Di Gudang',
      dataIndex: 'counted_qty',
      key: 'counted_qty',
      align: 'right',
      render: (qty) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatQty(qty)}
        </Text>
      ),
    },
    {
      title: 'Rincian',
      key: 'detail',
      render: (_, row) => {
        const detail = buildDetailText(row)
        const nonBase = (row.count_types || []).filter((ct) => !ct.is_base)
        return (
          <div>
            <Text type={detail === '—' ? 'secondary' : undefined}>{detail}</Text>
            {nonBase.map((ct) => (
              <div key={ct.uom}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  1 {ct.uom} = {formatQty(ct.factor_to_base)} {row.base_uom}
                </Text>
              </div>
            ))}
          </div>
        )
      },
    },
    {
      title: 'Selisih',
      dataIndex: 'variance',
      key: 'variance',
      render: (value, row) => (
        <Text
          strong
          style={{
            color: varianceColor(value),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatSignedQty(value)} {row.base_uom}
        </Text>
      ),
    },
  ]

  if (!loading && !sessionId) {
    return (
      <SesiLayout selectedKey="tinjau">
        <Empty
          description={
            <Space direction="vertical" size={4}>
              <Text strong>Belum ada sesi untuk ditinjau</Text>
              <Text type="secondary">
                Sesi muncul di sini setelah staff mengirim hitungan (status
                SUBMITTED).
              </Text>
            </Space>
          }
        />
      </SesiLayout>
    )
  }

  return (
    <SesiLayout selectedKey="tinjau">
      <Spin spinning={loading}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Flex
            justify="space-between"
            align="flex-start"
            wrap="wrap"
            gap="middle"
          >
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                Tinjau Selisih{' '}
                {varianceData?.code ? `- (${varianceData.code})` : ''}
              </Title>
              <Space wrap size="middle">
                <Text type="secondary">
                  {formatDateTime(varianceData?.snapshot_at)}
                </Text>
                {varianceData?.status &&
                varianceData.status !== 'REJECTED' ? (
                  <Tag
                    color={
                      varianceData.status === 'SUBMITTED'
                        ? 'warning'
                        : 'processing'
                    }
                    style={{ borderRadius: 8, margin: 0 }}
                  >
                    {varianceData.status}
                  </Tag>
                ) : null}
              </Space>
            </div>

            {canDecide ? (
              <Space>
                <Button
                  danger
                  size="middle"
                  icon={<CloseOutlined />}
                  onClick={() => setRejectOpen(true)}
                >
                  Tolak
                </Button>
                <Button
                  type="primary"
                  size="middle"
                  icon={<CheckOutlined />}
                  onClick={() => setApproveOpen(true)}
                >
                  Setujui
                </Button>
              </Space>
            ) : null}
          </Flex>

          {canDecide ? (
            <Alert
              type="info"
              showIcon
              message="Stok resmi berubah hanya setelah manajer menyetujui."
            />
          ) : varianceData?.status === 'REJECTED' ? (
            <div
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#fff',
                border: '1px solid #fecaca',
                borderLeft: '4px solid #dc2626',
                borderRadius: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    marginBottom: 4,
                  }}
                >
                  ALASAN
                </Text>
                <Text style={{ display: 'block', lineHeight: 1.5 }}>
                  {varianceData.reject_reason?.trim()
                    ? varianceData.reject_reason
                    : 'Tidak ada alasan yang dicatat.'}
                </Text>
              </div>
              <Tag
                color="error"
                style={{
                  margin: 0,
                  borderRadius: 6,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  flexShrink: 0,
                }}
              >
                DITOLAK
              </Tag>
            </div>
          ) : varianceData?.status &&
            varianceData.status !== 'COMPLETED' ? (
            <Alert
              type="info"
              showIcon
              message={`Sesi berstatus ${varianceData.status}`}
            />
          ) : null}

          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              {
                label: `Semua (${summary?.total_sku ?? items.length})`,
                value: 'all',
              },
              {
                label: `Ada Selisih (${summary?.variance_count ?? 0})`,
                value: 'variance',
              },
              {
                label: `Tidak Ada Selisih (${summary?.match_count ?? 0})`,
                value: 'zero',
              },
            ]}
          />

          <Table
            rowKey={(row) => row.product_id}
            columns={columns}
            dataSource={filteredItems}
            pagination={{
              current: page,
              pageSize,
              total: filteredItems.length,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} dari ${total}`,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              },
            }}
            locale={{
              emptyText:
                filter === 'variance'
                  ? 'Tidak ada baris dengan selisih.'
                  : filter === 'zero'
                    ? 'Tidak ada baris dengan selisih nol.'
                    : 'Belum ada item sesi.',
            }}
          />
        </Space>
      </Spin>

      <Modal
        open={approveOpen}
        title={
          <Flex align="flex-start" gap={12}>
            <div style={{ minWidth: 0, paddingTop: 2 }}>
              <Tag
                style={{
                  margin: '0 0 6px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                {warehouseLabel}
              </Tag>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
                Setujui sesi {varianceData?.code || ''}?
              </div>
            </div>
          </Flex>
        }
        onCancel={() => setApproveOpen(false)}
        footer={null}
        destroyOnClose
        centered
        width={480}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: '#f6f3ec',
              border: '1px solid #e5e2db',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            <Text
              type="secondary"
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                marginBottom: 10,
              }}
            >
              RINGKASAN PENYESUAIAN
            </Text>
            {approveSummary.length === 0 ? (
              <Text type="secondary">Tidak ada selisih pada sesi ini.</Text>
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {approveSummary.map((row) => (
                  <Flex
                    key={row.key}
                    justify="space-between"
                    align="baseline"
                    gap="small"
                    wrap="wrap"
                  >
                    <Text strong style={{ minWidth: 0 }}>
                      {row.name}
                    </Text>
                    <Text
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.expected} → {row.counted} {row.uom}
                    </Text>
                  </Flex>
                ))}
              </Space>
            )}
          </div>

          <Flex
            justify="end"
            gap="small"
            style={{
              paddingTop: 8,
              borderTop: '1px solid #e5e2db',
            }}
          >
            <Button size="middle" onClick={() => setApproveOpen(false)}>
              Batal
            </Button>
            <Button
              type="primary"
              size="middle"
              loading={approveMutation.isPending}
              onClick={handleApprove}
            >
              Setujui
            </Button>
          </Flex>
        </Space>
      </Modal>

      <Modal
        open={rejectOpen}
        title={
          <Flex align="flex-start" gap={12}>
            <div style={{ minWidth: 0, paddingTop: 2 }}>
              <Tag
                style={{
                  margin: '0 0 6px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                {warehouseLabel}
              </Tag>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
                Tolak sesi {varianceData?.code || ''}?
              </div>
            </div>
          </Flex>
        }
        onCancel={() => {
          setRejectOpen(false)
          setRejectReason('')
        }}
        footer={null}
        destroyOnClose
        centered
        width={480}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Alasan (opsional)
            </Text>
            <TextArea
              rows={4}
              maxLength={500}
              showCount
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: hitungan kardus belum lengkap"
              style={{ resize: 'none' }}
            />
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: '#f6f3ec',
              border: '1px solid #e5e2db',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              marginTop: 8,
            }}
          >
            <InfoCircleOutlined
              style={{ color: '#625d5b', marginTop: 2, flexShrink: 0 }}
            />
            <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Data SKU di Gudang tidak berubah dan sesi ditutup.
            </Text>
          </div>

          <Flex
            justify="end"
            gap="small"
            style={{
              paddingTop: 8,
              borderTop: '1px solid #e5e2db',
            }}
          >
            <Button
              size="middle"
              onClick={() => {
                setRejectOpen(false)
                setRejectReason('')
              }}
            >
              Batal
            </Button>
            <Button
              danger
              type="primary"
              size="middle"
              loading={rejectMutation.isPending}
              onClick={handleReject}
            >
              Tolak
            </Button>
          </Flex>
        </Space>
      </Modal>
    </SesiLayout>
  )
}

export default TinjauSelisih
