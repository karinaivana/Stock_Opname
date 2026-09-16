import React, { useEffect, useState } from 'react'
import {
  Button,
  Flex,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined, QrcodeOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { BASE_UOM_OPTIONS, formatFactor, SKU_STATUS_OPTIONS } from 'constants/units'
import { useProducts } from 'hooks/useProducts'
import SkuLayout from './SkuLayout'

const { Title, Text } = Typography

const EMPTY_LIST = []
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const statusTag = (active) =>
  active !== false ? (
    <Space size={6}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#166534',
          display: 'inline-block',
        }}
      />
      <Text style={{ color: '#166534', fontWeight: 500 }}>Aktif</Text>
    </Space>
  ) : (
    <Space size={6}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#5f5b56',
          display: 'inline-block',
        }}
      />
      <Text type="secondary" style={{ fontWeight: 500 }}>
        Nonaktif
      </Text>
    </Space>
  )

const SkuList = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('ALL')
  const [baseUom, setBaseUom] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState('sku')
  const [order, setOrder] = useState('asc')

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching } = useProducts({
    page,
    limit: pageSize,
    q: search,
    status,
    baseUom,
    sort,
    order,
  })

  const products = data?.items ?? EMPTY_LIST
  const total = data?.total ?? 0

  const columns = [
    {
      title: 'Stock Keeping Unit (SKU)',
      dataIndex: 'sku',
      key: 'sku',
      sorter: true,
      sortOrder:
        sort === 'sku' ? (order === 'desc' ? 'descend' : 'ascend') : null,
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
      title: 'Nama Barang',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder:
        sort === 'name' ? (order === 'desc' ? 'descend' : 'ascend') : null,
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Satuan Dasar',
      dataIndex: 'base_uom',
      key: 'base_uom',
      sorter: true,
      sortOrder:
        sort === 'base_uom' ? (order === 'desc' ? 'descend' : 'ascend') : null,
      render: (uom) => <Text type="secondary">{uom}</Text>,
    },
    {
      title: 'Tipe Hitungan',
      key: 'count_types',
      render: (_, row) => {
        const types = row.count_types || []
        if (!types.length) {
          return <Text type="secondary">-</Text>
        }
        return (
          <Space size={[4, 4]} wrap>
            {types.map((item) => (
              <Tag key={`${row.id}-${item.uom}`}>
                {item.uom} ×{formatFactor(item.factor_to_base)}
              </Tag>
            ))}
          </Space>
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
      render: (_, row) => (
        <Button size="small" onClick={() => navigate(`/inventori/sku/${row.id}`)}>
          Ubah
        </Button>
      ),
    },
  ]

  return (
    <SkuLayout selectedKey="sku">
      <Flex
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="middle"
        style={{ marginBottom: 16 }}
      >
        <div>
          <Title level={2}>
            Stock Keeping Unit
          </Title>
        </div>
        <Button
          type="primary"
          onClick={() => navigate('/inventori/sku/baru')}
        >
          Buat SKU Baru
        </Button>
      </Flex>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Flex wrap="wrap" gap="small">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Cari SKU atau nama..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            style={{ width: 180 }}
            options={SKU_STATUS_OPTIONS}
          />
          <Select
            allowClear
            placeholder="Semua Satuan Dasar"
            value={baseUom || undefined}
            onChange={(value) => {
              setBaseUom(value || '')
              setPage(1)
            }}
            style={{ width: 220 }}
            options={BASE_UOM_OPTIONS}
          />
        </Flex>

        <Table
          rowKey={(row) => row.id || row.sku}
          loading={isLoading || isFetching}
          columns={columns}
          dataSource={products}
          locale={{
            emptyText: search
              ? 'SKU tidak ditemukan. Pastikan kode SKU atau ejaan nama barang sudah sesuai.'
              : 'Belum ada SKU. Tambahkan SKU baru untuk katalog master.',
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (count, range) =>
              `${range[0]}-${range[1]} dari ${count}`,
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra?.action === 'paginate') {
              setPage(pagination.current)
              setPageSize(pagination.pageSize)
              return
            }

            if (extra?.action !== 'sort') return

            const nextSort = sorter?.field || 'sku'
            const nextOrder =
              sorter?.order === 'descend'
                ? 'desc'
                : sorter?.order === 'ascend'
                  ? 'asc'
                  : 'asc'
            const nextField = sorter?.order ? nextSort : 'sku'

            setSort(nextField)
            setOrder(sorter?.order ? nextOrder : 'asc')
            setPage(1)
          }}
        />
      </Space>
    </SkuLayout>
  )
}

export default SkuList
