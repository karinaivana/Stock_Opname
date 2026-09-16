import React, { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Flex,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  LockOutlined,
  QrcodeOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import SesiLayout from './SesiLayout'
import {
  useCreateSessionMutation,
  useSessionCandidates,
  useSessions,
} from 'hooks/useSessions'

const { Title, Text } = Typography

const EMPTY_LIST = []

const formatQty = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return parsed.toLocaleString('id-ID', {
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 1,
    maximumFractionDigits: 3,
  })
}

const buildFactorHints = (items = []) => {
  const hints = []
  const seen = new Set()

  items.forEach((item) => {
    ;(item.count_types || [])
      .filter((ct) => !ct.is_base)
      .forEach((ct) => {
        const key = `${ct.uom}:${ct.factor_to_base}:${item.base_uom}`
        if (seen.has(key)) return
        seen.add(key)
        hints.push(
          `1 ${ct.uom} = ${formatQty(ct.factor_to_base)} ${item.base_uom}`
        )
      })
  })

  return hints
}

const CreateSession = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState([])
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const { data: sessionsData, isLoading: sessionsLoading } = useSessions()
  const {
    data: candidatesData,
    isLoading: candidatesLoading,
    isFetching: candidatesFetching,
  } = useSessionCandidates()
  const createMutation = useCreateSessionMutation()

  const hasActiveSession = Boolean(sessionsData?.has_active_session)
  const warehouse = sessionsData?.warehouse || candidatesData?.warehouse
  const candidates = candidatesData?.items ?? EMPTY_LIST

  useEffect(() => {
    if (sessionsLoading) return
    if (hasActiveSession) {
      message.warning(
        `Tidak bisa membuat sesi baru. Masih ada sesi aktif (${sessionsData?.active_session?.code}).`
      )
      navigate('/sesi', { replace: true })
    }
  }, [
    hasActiveSession,
    message,
    navigate,
    sessionsData?.active_session?.code,
    sessionsLoading,
  ])

  useEffect(() => {
    if (initialized || candidatesLoading) return
    setSelectedIds(candidates.map((item) => item.product_id))
    setInitialized(true)
  }, [candidates, candidatesLoading, initialized])

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (item) =>
        item.sku?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q)
    )
  }, [candidates, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const selectedItems = useMemo(
    () => candidates.filter((item) => selectedIds.includes(item.product_id)),
    [candidates, selectedIds]
  )

  const factorHints = useMemo(
    () => buildFactorHints(selectedItems),
    [selectedItems]
  )

  const warehouseLabel = warehouse
    ? `${warehouse.name}${warehouse.code ? ` (${warehouse.code})` : ''}`
    : 'gudang ini'

  const handleOpenSnapshot = () => {
    if (selectedIds.length === 0) {
      message.warning('Pilih minimal satu SKU untuk snapshot.')
      return
    }
    setSnapshotOpen(true)
  }

  const handleConfirmSnapshot = async () => {
    try {
      const session = await createMutation.mutateAsync({
        productIds: selectedIds,
      })
      message.success(
        `Snapshot ${session?.code || ''} dikunci. Status COUNTING — stok resmi belum berubah.`
      )
      setSnapshotOpen(false)
      if (session?.id) {
        navigate(`/sesi/${session.id}`)
      } else {
        navigate('/sesi')
      }
    } catch (error) {
      message.error(error.message || 'Gagal mengunci snapshot')
    }
  }

  const candidateColumns = [
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
      render: (uom) => <Text type="secondary">{uom}</Text>,
    },
    {
      title: 'Kuantitas Fisik',
      dataIndex: 'on_hand_qty',
      key: 'on_hand_qty',
      align: 'right',
      render: (qty, row) => (
        <Text
          strong
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: "'tnum' 1, 'zero' 1",
          }}
        >
          {formatQty(qty)} {row.base_uom}
        </Text>
      ),
    },
  ]

  if (hasActiveSession) {
    return (
      <SesiLayout selectedKey="sesi">
        <Spin spinning />
      </SesiLayout>
    )
  }

  return (
    <SesiLayout selectedKey="sesi">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
            Kembali ke Daftar Sesi
          </Button>

          <Flex
            justify="space-between"
            align="flex-start"
            wrap="wrap"
            gap={16}
          >
            <div style={{ minWidth: 0, flex: '1 1 280px' }}>
              <Title level={2} style={{ margin: '4px 0 6px' }}>
                Pilih Stock Keeping Unit (SKU)
              </Title>
              <Text type="secondary">
                Default semua SKU aktif yang memiliki stok di {warehouseLabel}
              </Text>
              <div style={{ marginTop: 12 }}>
                <Text strong>
                  {selectedIds.length} Stock Keeping Unit (SKU) dipilih
                </Text>
              </div>
            </div>

            <Space
              direction="vertical"
              size={12}
              align="end"
              style={{ flexShrink: 0, width: 320, maxWidth: '100%' }}
            >
              <Space>
                <Button size="large" onClick={() => navigate('/sesi')}>
                  Batal
                </Button>
                <Button
                  type="primary"
                  size="large"
                  disabled={selectedIds.length === 0}
                  onClick={handleOpenSnapshot}
                >
                  Lanjut ke Snapshots
                </Button>
              </Space>
              <Input
                allowClear
                size="large"
                prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="Cari SKU atau nama"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </Space>
          </Flex>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e2db',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <Spin
            spinning={
              sessionsLoading || candidatesLoading || candidatesFetching
            }
          >
            <Table
              rowKey={(row) => row.product_id}
              columns={candidateColumns}
              dataSource={filteredCandidates}
              scroll={{ y: 'calc(100vh - 360px)' }}
              pagination={{
                current: page,
                pageSize,
                total: filteredCandidates.length,
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
                  'Tidak ada SKU dengan stok awal di gudang ini. Minta Admin Inventori mengisi stok awal dulu.',
              }}
              rowSelection={{
                selectedRowKeys: selectedIds,
                preserveSelectedRowKeys: true,
                onChange: (keys) => setSelectedIds(keys),
                columnWidth: 64,
                getCheckboxProps: () => ({
                  style: { transform: 'scale(1.2)' },
                }),
              }}
            />
          </Spin>
        </div>
      </Space>

      <Modal
        open={snapshotOpen}
        title="Konfirmasi snapshot"
        onCancel={() => setSnapshotOpen(false)}
        footer={null}
        destroyOnClose
        centered
        width={440}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: '#fafafa',
              border: '1px solid #e5e2db',
              borderRadius: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Text
                type="secondary"
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                GUDANG
              </Text>
              <Text strong ellipsis>
                {warehouseLabel}
              </Text>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Text
                type="secondary"
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                SKU DIPILIH
              </Text>
              <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                {selectedIds.length}
              </Text>
            </div>
          </div>

          <Text type="secondary" style={{ lineHeight: 1.55 }}>
            Expected qty dikunci dari on-hand saat ini. Stok resmi belum
            berubah di langkah ini.
          </Text>

          {factorHints.length > 0 ? (
            <div>
              <Text
                type="secondary"
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  marginBottom: 8,
                }}
              >
                FAKTOR PACKING ({factorHints.length})
              </Text>
              <div
                style={{
                  maxHeight: 148,
                  overflowY: 'auto',
                  border: '1px solid #e5e2db',
                  borderRadius: 10,
                  background: '#fff',
                }}
              >
                {factorHints.map((hint, index) => (
                  <div
                    key={hint}
                    style={{
                      padding: '8px 12px',
                      borderBottom:
                        index < factorHints.length - 1
                          ? '1px solid #f0ece4'
                          : 'none',
                    }}
                  >
                    <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {hint}
                    </Text>
                  </div>
                ))}
              </div>
              <Text
                type="secondary"
                style={{ display: 'block', marginTop: 8, fontSize: 12 }}
              >
                Faktor di atas ikut dikunci untuk sesi ini.
              </Text>
            </div>
          ) : null}

          <Flex justify="end" gap="small" style={{ marginTop: 4 }}>
            <Button size="large" onClick={() => setSnapshotOpen(false)}>
              Kembali
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<LockOutlined />}
              loading={createMutation.isPending}
              onClick={handleConfirmSnapshot}
            >
              Kunci snapshot & mulai hitung
            </Button>
          </Flex>
        </Space>
      </Modal>
    </SesiLayout>
  )
}

export default CreateSession
