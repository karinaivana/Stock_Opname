import React, { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Flex,
  InputNumber,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  HomeOutlined,
  LockOutlined,
  QrcodeOutlined,
} from '@ant-design/icons'
import SkuLayout from 'pages/Sku/SkuLayout'
import { useWarehouses } from 'hooks/useWarehouses'
import { useInventory, useOpeningStockMutation } from 'hooks/useInventory'

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

const QTY_ALLOWED_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
])

const handleQtyKeyDown = (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (QTY_ALLOWED_KEYS.has(e.key)) return
  if (/^\d$/.test(e.key) || e.key === ',') return
  e.preventDefault()
}

const parseQtyInput = (value) => {
  if (value == null || value === '') return ''
  const cleaned = String(value).replace(/[^\d,]/g, '')
  const [intPart, ...rest] = cleaned.split(',')
  if (rest.length === 0) return intPart
  return `${intPart}.${rest.join('').slice(0, 3)}`
}

const StokAwal = () => {
  const { message, modal } = App.useApp()
  const [warehouseId, setWarehouseId] = useState(null)
  const [draftQty, setDraftQty] = useState({})

  const { data: warehouseData, isLoading: warehousesLoading } = useWarehouses({
    page: 1,
    limit: 100,
    status: 'AKTIF',
  })

  const warehouses = warehouseData?.items ?? EMPTY_LIST

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouseId, warehouses])

  const {
    data: inventory,
    isLoading: inventoryLoading,
    isFetching: inventoryFetching,
  } = useInventory(warehouseId)

  const mutation = useOpeningStockMutation()

  const items = inventory?.items ?? EMPTY_LIST
  const summary = inventory?.summary
  const warehouse = inventory?.warehouse
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (Boolean(a.is_filled) === Boolean(b.is_filled)) return 0
        return a.is_filled ? 1 : -1
      }),
    [items]
  )
  const emptyItems = useMemo(
    () => items.filter((item) => !item.is_filled),
    [items]
  )
  const hasEmptyRows = emptyItems.length > 0
  const allFilled = items.length > 0 && emptyItems.length === 0

  useEffect(() => {
    setDraftQty({})
  }, [
    warehouseId,
    inventory?.summary?.empty_count,
    inventory?.summary?.filled_count,
  ])

  const warehouseLabel = warehouse
    ? `${warehouse.name}${warehouse.code ? ` (${warehouse.code})` : ''}`
    : warehouses.find((item) => item.id === warehouseId)?.name || 'gudang ini'

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((item) => {
        const baseLabel = `${item.name}${item.code ? ` (${item.code})` : ''}`
        if (item.id !== warehouseId || !inventory) {
          return { value: item.id, label: baseLabel }
        }

        return {
          value: item.id,
          label: `${baseLabel}`,
        }
      }),
    [warehouses, warehouseId, inventory, allFilled]
  )

  const handleSave = () => {
    const missing = emptyItems.filter((item) => {
      const value = draftQty[item.product_id]
      return value === null || value === undefined || value === ''
    })

    if (missing.length > 0) {
      message.warning(
        'Seluruh on-hand SKU yang masih kosong wajib diisi sebelum menyimpan stok awal.'
      )
      return
    }

    modal.confirm({
      title: 'Konfirmasi Simpan Stok Awal',
      icon: <LockOutlined style={{ color: '#B45309' }} />,
      content: (
        <Space direction="vertical" size={8}>
          <Text>
            Nilai ini akan terkunci permanen di halaman stok awal dan menjadi
            saldo buku resmi untuk <Text strong>{warehouseLabel}</Text>.
          </Text>
        </Space>
      ),
      okText: 'Simpan Stok Awal',
      cancelText: 'Batal',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await mutation.mutateAsync({
            warehouseId,
            items: emptyItems.map((item) => ({
              productId: item.product_id,
              onHandQty: Number(draftQty[item.product_id]),
            })),
          })
          message.success(
            `Stok Awal berhasil disimpan dan terkunci.`
          )
        } catch (error) {
          message.error(error.message || 'Gagal menyimpan stok awal')
          throw error
        }
      },
    })
  }

  const columns = [
    {
      title: 'Stock Keeping Unit (SKU)',
      dataIndex: 'sku',
      key: 'sku',
      width: 220,
      render: (sku) => (
        <Space size={6} style={{ whiteSpace: 'nowrap' }}>
          <QrcodeOutlined style={{ color: '#625d5b' }} />
          <Text code style={{ whiteSpace: 'nowrap' }}>
            {sku}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Nama',
      dataIndex: 'name',
      key: 'name',
      render: (name, row) => {
        return (
          <div>
            <Text strong>{name}</Text>
          </div>
        )
      },
    },
    {
      title: 'Satuan Dasar',
      dataIndex: 'base_uom',
      key: 'base_uom',
      width: 150,
      render: (uom) => <Text type="secondary">{uom}</Text>,
    },
    {
      title: hasEmptyRows ? 'Kuantitas Fisik Awal' : 'Kuantitas Fisik',
      key: 'on_hand_qty',
      align: 'right',
      width: 200,
      render: (_, row) => {
        if (row.is_filled) {
          return (
            <Text
              strong
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: "'tnum' 1, 'zero' 1",
              }}
            >
              {formatQty(row.on_hand_qty)} {row.base_uom}
            </Text>
          )
        }

        return (
          <Space size={6}>
            <InputNumber
              min={0}
              step={0.1}
              precision={3}
              decimalSeparator=","
              placeholder="0,0"
              value={draftQty[row.product_id]}
              onChange={(value) =>
                setDraftQty((prev) => ({
                  ...prev,
                  [row.product_id]: value,
                }))
              }
              parser={parseQtyInput}
              onKeyDown={handleQtyKeyDown}
              style={{ width: 120 }}
              controls={false}
            />
            <Text type="secondary">{row.base_uom}</Text>
          </Space>
        )
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_, row) =>
        row.is_filled ? (
          <Tag color="success" style={{ borderRadius: 8, margin: 0 }}>
            SUDAH DIISI
          </Tag>
        ) : (
          <Tag color="warning" style={{ borderRadius: 8, margin: 0 }}>
            BELUM DIISI
          </Tag>
        ),
    },
  ]

  return (
    <SkuLayout selectedKey="stok-awal">
      <Flex
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="middle"
        style={{ marginBottom: 16 }}
      >
        <div>
          <Title level={2}>
            Stok awal
          </Title>
        </div>
        {hasEmptyRows ? (
          <Button
            type="primary"
            size="large"
            loading={mutation.isPending}
            onClick={handleSave}
          >
            Simpan Stok Awal
          </Button>
        ) : null}
      </Flex>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Flex
          align="center"
          justify="space-between"
          wrap="wrap"
          gap="middle"
          style={{
            padding: 16,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Flex align="center" wrap="wrap" gap="middle" style={{ flex: 1 }}>
            <Space size={8}>
              <HomeOutlined style={{ color: '#F01111', fontSize: 18 }} />
              <Text strong style={{ color: '#625d5b' }}>
                Nama Gudang
              </Text>
            </Space>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Pilih gudang"
              value={warehouseId || undefined}
              loading={warehousesLoading}
              onChange={(value) => setWarehouseId(value)}
              options={warehouseOptions}
              style={{ minWidth: 320, maxWidth: 420, flex: 1 }}
            />
          </Flex>
          {hasEmptyRows ? (
            <Tag color="warning" style={{ borderRadius: 8, margin: 0 }}>
              STATUS: ADA ITEM BELUM DIISI
            </Tag>
          ) : null}
        </Flex>

        <Spin
          spinning={warehousesLoading || inventoryLoading || inventoryFetching}
        >
          <Table
            key={warehouseId || 'stok-awal'}
            rowKey={(row) => row.product_id}
            columns={columns}
            dataSource={sortedItems}
            pagination={{
              defaultPageSize: 10,
              pageSizeOptions: [10, 20, 50],
              showSizeChanger: true,
            }}
            locale={{
              emptyText: warehouseId
                ? 'Belum ada SKU aktif. Tambahkan SKU di katalog master terlebih dahulu.'
                : 'Pilih gudang untuk melihat stok awal.',
            }}
          />
        </Spin>

        {allFilled ? (
          <Text type="secondary">
            Untuk mengubah angka ini, manajer gudang menjalankan stock opname.
          </Text>
        ) : null}
      </Space>
    </SkuLayout>
  )
}

export default StokAwal
