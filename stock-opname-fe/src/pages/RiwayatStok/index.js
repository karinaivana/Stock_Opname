import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Empty,
  Flex,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import { LockOutlined, QrcodeOutlined } from '@ant-design/icons'
import { getSessionUser } from 'helpers/auth_helper'
import { formatDateTime } from 'helpers/util'
import { ROLES } from 'constants/roles'
import { useWarehouses } from 'hooks/useWarehouses'
import { useAuditLogs } from 'hooks/useAuditLogs'
import SesiLayout from 'pages/Sesi/SesiLayout'
import SkuLayout from 'pages/Sku/SkuLayout'
import AdminLayout from 'pages/SetupSistem/AdminLayout'

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

const RiwayatStokContent = () => {
  const user = getSessionUser()
  const isManager = user?.role === ROLES.WAREHOUSE_MANAGER
  const lockedWarehouseId = user?.warehouse?.id || null

  const [warehouseId, setWarehouseId] = useState(
    isManager ? lockedWarehouseId : null
  )

  useEffect(() => {
    if (isManager && lockedWarehouseId) {
      setWarehouseId(lockedWarehouseId)
    }
  }, [isManager, lockedWarehouseId])

  const { data: warehouseData, isLoading: warehousesLoading } = useWarehouses({
    page: 1,
    limit: 100,
    status: 'AKTIF',
    enabled: !isManager,
  })

  const warehouses = warehouseData?.items ?? EMPTY_LIST

  const {
    data: auditData,
    isLoading: auditLoading,
    isFetching: auditFetching,
  } = useAuditLogs(warehouseId)

  const items = auditData?.items ?? EMPTY_LIST
  const warehouseOptions = useMemo(() => {
    if (isManager && user?.warehouse) {
      return [
        {
          value: user.warehouse.id,
          label: `${user.warehouse.name || 'Gudang'}${
            user.warehouse.code ? ` (${user.warehouse.code})` : ''
          }`,
        },
      ]
    }
    return warehouses.map((item) => ({
      value: item.id,
      label: `${item.name}${item.code ? ` (${item.code})` : ''}`,
    }))
  }, [isManager, user, warehouses])

  const columns = [
    {
      title: 'Sesi',
      dataIndex: 'session_code',
      key: 'session_code',
      width: 160,
      render: (code) => <Text code>{code}</Text>,
    },
    {
      title: 'Stock Keeping Unit (SKU)',
      key: 'sku',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <QrcodeOutlined style={{ color: '#625d5b' }} />
            <Text code>{row.sku}</Text>
          </Space>
          <Text type="secondary">{row.product_name}</Text>
        </Space>
      ),
    },
    {
      title: 'Kuantitas Sebelum',
      key: 'qty_before',
      align: 'right',
      render: (_, row) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatQty(row.qty_before)} {row.base_uom}
        </Text>
      ),
    },
    {
      title: 'Kuantitas Sesudah',
      key: 'qty_after',
      align: 'right',
      render: (_, row) => {
        const before = Number(row.qty_before)
        const after = Number(row.qty_after)
        const changed = Number.isFinite(before) && Number.isFinite(after) && before !== after
        return (
          <Text
            strong
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: changed && after < before ? '#7f1d1d' : undefined,
            }}
          >
            {formatQty(row.qty_after)} {row.base_uom}
          </Text>
        )
      },
    },
    {
      title: 'Waktu Snapshot',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: formatDateTime,
    },
    {
      title: 'Disetujui Oleh',
      dataIndex: 'approved_by_name',
      key: 'approved_by_name',
      render: (name) => <Text>{name || '-'}</Text>,
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Title level={2}>
          Riwayat Stok
        </Title>
      </div>

      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Nama Gudang <Text type="danger">*</Text>
        </Text>
        <Select
          showSearch={!isManager}
          optionFilterProp="label"
          placeholder="Pilih Gudang"
          value={warehouseId || undefined}
          disabled={isManager}
          loading={!isManager && warehousesLoading}
          onChange={(value) => setWarehouseId(value)}
          style={{ width: '100%', maxWidth: 420 }}
          options={warehouseOptions}
          suffixIcon={isManager ? <LockOutlined /> : undefined}
        />
      </div>

      <Spin spinning={auditLoading || auditFetching}>
        <Table
          rowKey={(row) => row.id}
          columns={columns}
          dataSource={items}
          pagination={{
            defaultPageSize: 10,
            pageSizeOptions: [10, 20, 50],
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} dari ${total}`,
          }}
          locale={{
            emptyText: (
              <Empty description="Belum ada mutasi stok resmi untuk gudang ini." />
            ),
          }}
        />
      </Spin>
    </Space>
  )
}

const RiwayatStok = () => {
  const user = getSessionUser()
  const role = user?.role

  if (role === ROLES.WAREHOUSE_MANAGER) {
    return (
      <SesiLayout selectedKey="audit">
        <RiwayatStokContent />
      </SesiLayout>
    )
  }

  if (role === ROLES.INVENTORY_ADMIN) {
    return (
      <SkuLayout selectedKey="audit">
        <RiwayatStokContent />
      </SkuLayout>
    )
  }

  return (
    <AdminLayout selectedKey="audit">
      <RiwayatStokContent />
    </AdminLayout>
  )
}

export default RiwayatStok
