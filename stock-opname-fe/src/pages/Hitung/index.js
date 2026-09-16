import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowUpOutlined,
  CheckCircleOutlined,
  LockOutlined,
  QrcodeOutlined,
  SendOutlined,
} from '@ant-design/icons'
import HitungLayout from './HitungLayout'
import {
  useSession,
  useSessions,
  useSubmitCountsMutation,
} from 'hooks/useSessions'

const { Title, Text } = Typography

const EMPTY_LIST = []

const formatQty = (value) => {
  if (value === null || value === undefined || value === '') return '-'
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

const labelUom = (uom = '') => {
  if (!uom) return ''
  return uom.charAt(0).toUpperCase() + uom.slice(1)
}

const buildEmptyDrafts = (items = []) => {
  const next = {}
  items.forEach((item) => {
    next[item.product_id] = {}
    ;(item.count_types || []).forEach((ct) => {
      next[item.product_id][ct.uom] = null
    })
  })
  return next
}

const buildDraftsFromCounts = (items = []) => {
  const next = buildEmptyDrafts(items)
  items.forEach((item) => {
    ;(item.counts || []).forEach((count) => {
      if (!next[item.product_id]) next[item.product_id] = {}
      next[item.product_id][count.uom] = Number(count.qty)
    })
  })
  return next
}

const hasQtyValue = (value) =>
  value !== null && value !== undefined && value !== ''

/** SKU dianggap sudah dihitung jika minimal satu satuan terisi. Satuan kosong = 0. */
const isItemComplete = (item, drafts) => {
  const row = drafts[item.product_id] || {}
  return (item.count_types || []).some((ct) => hasQtyValue(row[ct.uom]))
}

const qtyOrZero = (value) => (hasQtyValue(value) ? Number(value) : 0)

const computeBaseTotal = (item, drafts) => {
  const row = drafts[item.product_id] || {}
  let total = 0
  let hasAny = false

  ;(item.count_types || []).forEach((ct) => {
    const value = row[ct.uom]
    if (value === null || value === undefined || value === '') return
    hasAny = true
    total += Number(value) * Number(ct.factor_to_base || 0)
  })

  if (!hasAny) return null
  return Math.round(total * 1000) / 1000
}

const buildEquation = (item, drafts) => {
  const parts = []
  ;(item.count_types || []).forEach((ct) => {
    const value = drafts[item.product_id]?.[ct.uom]
    if (value === null || value === undefined || value === '') return
    parts.push(`${formatQty(value)} ${ct.uom} × ${formatQty(ct.factor_to_base)}`)
  })
  if (!parts.length) return null
  const total = computeBaseTotal(item, drafts)
  return `(${parts.join(') + (')}) = ${formatQty(total)} ${item.base_uom}`
}

const buildSummaryLine = (item, drafts) => {
  const types = item.count_types || []
  const isCompound = types.length > 1
  const total = computeBaseTotal(item, drafts)

  if (!isCompound) {
    const uom = types[0]?.uom || item.base_uom
    const qty = drafts[item.product_id]?.[uom]
    return `${item.name} ${formatQty(qty)} ${uom}`
  }

  const parts = types
    .map((ct) => {
      const qty = qtyOrZero(drafts[item.product_id]?.[ct.uom])
      return `${formatQty(qty)} ${ct.uom}`
    })
    .join(' + ')

  return `${item.name} ${parts} = ${formatQty(total)} ${item.base_uom}`
}

const HitungPage = () => {
  const { message } = App.useApp()
  const [drafts, setDrafts] = useState({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [skuFilter, setSkuFilter] = useState('all')
  const [showScrollTop, setShowScrollTop] = useState(false)

  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    isFetching: sessionsFetching,
  } = useSessions()

  const active = sessionsData?.active_session || null
  const countingSession = useMemo(() => {
    const items = sessionsData?.items || EMPTY_LIST
    return (
      items.find((item) => item.status === 'COUNTING') ||
      (active?.status === 'COUNTING' ? active : null)
    )
  }, [sessionsData, active])

  const submittedSession = useMemo(() => {
    const items = sessionsData?.items || EMPTY_LIST
    if (active && active.status !== 'COUNTING') return active
    return items.find((item) =>
      ['SUBMITTED', 'APPROVED', 'RECONCILING'].includes(item.status)
    )
  }, [sessionsData, active])

  const targetSessionId = countingSession?.id || submittedSession?.id || null
  const editable = Boolean(countingSession)

  const {
    data: session,
    isLoading: sessionLoading,
    isFetching: sessionFetching,
  } = useSession(targetSessionId)

  const submitMutation = useSubmitCountsMutation()

  const items = session?.items ?? EMPTY_LIST

  useEffect(() => {
    if (!session?.id || !Array.isArray(session.items)) return
    if (session.status === 'COUNTING') {
      setDrafts(buildEmptyDrafts(session.items))
      return
    }
    setDrafts(buildDraftsFromCounts(session.items))
  }, [session?.id, session?.status])

  const filledCount = useMemo(
    () => items.filter((item) => isItemComplete(item, drafts)).length,
    [items, drafts]
  )
  const allFilled = items.length > 0 && filledCount === items.length

  const unfilledCount = items.length - filledCount
  const varianceCount = useMemo(
    () =>
      items.filter((item) => {
        const total = computeBaseTotal(item, drafts)
        if (total == null || item.expected_qty == null) return false
        return total - Number(item.expected_qty) !== 0
      }).length,
    [items, drafts]
  )

  const filteredItems = useMemo(() => {
    if (skuFilter === 'unfilled') {
      return items.filter((item) => !isItemComplete(item, drafts))
    }
    if (skuFilter === 'variance') {
      return items.filter((item) => {
        const total = computeBaseTotal(item, drafts)
        if (total == null || item.expected_qty == null) return false
        return total - Number(item.expected_qty) !== 0
      })
    }
    return items
  }, [items, drafts, skuFilter])

  useEffect(() => {
    const updateScrollTopVisibility = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const viewport = window.innerHeight
      const fullHeight = document.documentElement.scrollHeight
      const canScroll = fullHeight > viewport + 160
      const nearBottom = scrollTop + viewport >= fullHeight - 140
      setShowScrollTop(canScroll && nearBottom)
    }

    updateScrollTopVisibility()
    window.addEventListener('scroll', updateScrollTopVisibility, {
      passive: true,
    })
    window.addEventListener('resize', updateScrollTopVisibility)
    return () => {
      window.removeEventListener('scroll', updateScrollTopVisibility)
      window.removeEventListener('resize', updateScrollTopVisibility)
    }
  }, [filteredItems.length, skuFilter])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setQty = (productId, uom, value) => {
    setDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [uom]: value,
      },
    }))
  }

  const handleOpenConfirm = () => {
    if (!allFilled) {
      message.warning(
        'Setiap SKU wajib punya minimal satu angka hitungan. Satuan yang kosong dihitung sebagai 0.'
      )
      return
    }
    setConfirmOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const payloadItems = items.map((item) => ({
        productId: item.product_id,
        counts: (item.count_types || []).map((ct) => ({
          uom: ct.uom,
          qty: qtyOrZero(drafts[item.product_id]?.[ct.uom]),
        })),
      }))

      await submitMutation.mutateAsync({
        sessionId: session.id,
        items: payloadItems,
      })
      setConfirmOpen(false)
      message.success(
        'Hitungan terkirim ke Manajer Gudang'
      )
    } catch (error) {
      message.error(error.message || 'Gagal mengirim hitungan')
    }
  }

  const warehouseLabel = session?.warehouse
    ? `${session.warehouse.name}${
        session.warehouse.code ? ` (${session.warehouse.code})` : ''
      }`
    : sessionsData?.warehouse?.name || 'gudang ini'

  const loading =
    sessionsLoading ||
    sessionsFetching ||
    (Boolean(targetSessionId) && (sessionLoading || sessionFetching))

  if (!loading && !targetSessionId) {
    return (
      <HitungLayout>
        <Empty
          description={
            <Space direction="vertical" size={4}>
              <Text strong>Belum ada sesi yang ditugaskan</Text>
              <Text type="secondary">
                Minta manajer gudang memulai stock opname.
              </Text>
            </Space>
          }
        />
      </HitungLayout>
    )
  }

  return (
    <HitungLayout>
      <Spin spinning={loading}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Flex
            justify="space-between"
            align="flex-start"
            wrap="wrap"
            gap="middle"
          >
            <div>
              <Title level={2} style={{ margin: '4px 0' }}>
                Sesi {session?.code || '-'} · Perhitungan Fisik
              </Title>
              <Space wrap>
                <Tag style={{ borderRadius: 8 }}>{warehouseLabel}</Tag>
              </Space>
            </div>

            {editable ? (
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                disabled={!allFilled}
                onClick={handleOpenConfirm}
              >
                Kirim Hitungan Fisik
              </Button>
            ) : null}
          </Flex>

          {!editable ? (
            <Alert
              type="success"
              showIcon
              message="Perhitungan fisik sudah dikirim dan menunggu persetujuan manajer."
            />
          ) : null}

          <Segmented
            value={skuFilter}
            onChange={setSkuFilter}
            options={[
              {
                label: `Semua (${items.length})`,
                value: 'all',
              },
              {
                label: `Belum Dihitung (${unfilledCount})`,
                value: 'unfilled',
              },
              {
                label: `Ada Selisih (${varianceCount})`,
                value: 'variance',
              },
            ]}
          />

          {filteredItems.length === 0 ? (
            <Empty
              description={
                skuFilter === 'unfilled'
                  ? 'Semua Stock Keeping Unit (SKU) sudah dihitung.'
                  : skuFilter === 'variance'
                    ? 'Tidak ada Stock Keeping Unit (SKU) dengan selisih.'
                    : 'Belum ada Stock Keeping Unit (SKU) pada sesi ini.'
              }
            />
          ) : null}

          {filteredItems.map((item) => {
            const types = item.count_types || []
            const isCompound = types.length > 1
            const total = computeBaseTotal(item, drafts)
            const expected = item.expected_qty
            const variance =
              total == null || expected == null ? null : total - Number(expected)
            const nonBase = types.filter((ct) => !ct.is_base)
            const statusTag =
              variance == null
                ? {
                    color: 'default',
                    label: 'Belum Dihitung',
                  }
                : variance === 0
                  ? {
                      color: 'success',
                      label: 'Tidak Ada Selisih',
                    }
                  : {
                      color: 'error',
                      label: 'Ada Selisih',
                    }

            return (
              <Card
                key={item.product_id}
                style={{ borderRadius: 8, borderColor: '#e5e2db' }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Flex justify="space-between" align="flex-start" gap="middle">
                    <div style={{ minWidth: 0 }}>
                      <Space size={6}>
                        <QrcodeOutlined style={{ color: '#625d5b' }} />
                        <Text code>{item.sku}</Text>
                      </Space>
                      <Title level={4} style={{ margin: '4px 0' }}>
                        {item.name}
                      </Title>
                      <Text type="secondary">
                        Satuan dasar: {item.base_uom}
                      </Text>
                    </div>
                    <Tag
                      color={statusTag.color}
                      style={{
                        margin: 0,
                        borderRadius: 8,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {statusTag.label}
                    </Tag>
                  </Flex>

                  <Flex
                    justify="space-between"
                    wrap="wrap"
                    gap="small"
                    style={{
                      padding: 12,
                      background: '#f6f3ec',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <Text
                        type="secondary"
                        style={{ fontSize: 11, fontWeight: 700 }}
                      >
                        Total di Sistem
                      </Text>
                      <div>
                        <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatQty(item.expected_qty)} {item.base_uom}
                        </Text>
                      </div>
                    </div>
                    {variance != null ? (
                      <div style={{ textAlign: 'right' }}>
                        <Text
                          type="secondary"
                          style={{ fontSize: 11, fontWeight: 700 }}
                        >
                          SELISIH SEMENTARA
                        </Text>
                        <div>
                          <Text
                            strong
                            style={{
                              color:
                                variance === 0
                                  ? '#57534e'
                                  : variance < 0
                                    ? '#7f1d1d'
                                    : '#b45309',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {variance > 0 ? '+' : ''}
                            {formatQty(variance)} {item.base_uom}
                          </Text>
                        </div>
                      </div>
                    ) : null}
                  </Flex>

                  {!isCompound ? (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Hasil Hitung Fisik
                      </Text>
                      <Space size="middle" align="center">
                        <InputNumber
                          min={0}
                          step={0.1}
                          precision={3}
                          decimalSeparator=","
                          placeholder="0,0"
                          disabled={!editable}
                          value={drafts[item.product_id]?.[types[0]?.uom]}
                          onChange={(value) =>
                            setQty(item.product_id, types[0]?.uom, value)
                          }
                          parser={parseQtyInput}
                          onKeyDown={handleQtyKeyDown}
                          style={{
                            width: 180,
                            height: 48,
                            fontSize: 20,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                          controls={false}
                        />
                        <Text style={{ fontSize: 16 }}>{item.base_uom}</Text>
                      </Space>
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">
                          Hitung hanya barang yang masih layak. Barang rusak
                          tidak perlu dimasukkan.
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Hasil Hitung Fisik
                      </Text>
                      <Row gutter={[16, 16]}>
                        {types.map((ct) => (
                          <Col xs={24} md={12} key={ct.uom}>
                            <Text
                              type="secondary"
                              style={{ display: 'block', marginBottom: 6 }}
                            >
                              {labelUom(ct.uom)}
                            </Text>
                            <Space align="center">
                              <InputNumber
                                min={0}
                                step={0.1}
                                precision={3}
                                decimalSeparator=","
                                placeholder="0,0"
                                disabled={!editable}
                                value={drafts[item.product_id]?.[ct.uom]}
                                onChange={(value) =>
                                  setQty(item.product_id, ct.uom, value)
                                }
                                parser={parseQtyInput}
                                onKeyDown={handleQtyKeyDown}
                                style={{
                                  width: 160,
                                  height: 48,
                                  fontSize: 20,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                                controls={false}
                              />
                              <Text>{ct.uom}</Text>
                            </Space>
                          </Col>
                        ))}
                      </Row>

                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          border: '1px solid #e5e2db',
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          type="secondary"
                          style={{ fontSize: 11, fontWeight: 700 }}
                        >
                          KONVERSI & TOTAL
                        </Text>
                        <div>
                          <Text strong style={{ fontSize: 18 }}>
                            = {total == null ? '—' : formatQty(total)}{' '}
                            {item.base_uom}
                          </Text>
                        </div>
                        {buildEquation(item, drafts) ? (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {buildEquation(item, drafts)}
                          </Text>
                        ) : null}
                        {nonBase.map((ct) => (
                          <div key={ct.uom}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <LockOutlined style={{ marginRight: 4 }} />
                              1 {ct.uom} = {formatQty(ct.factor_to_base)}{' '}
                              {item.base_uom}
                            </Text>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Space>
              </Card>
            )
          })}
        </Space>
      </Spin>

      {showScrollTop ? (
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<ArrowUpOutlined />}
          onClick={scrollToTop}
          aria-label="Kembali ke atas"
          title="Kembali ke atas"
          style={{
            position: 'fixed',
            right: 28,
            bottom: 28,
            zIndex: 100,
            width: 48,
            height: 48,
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
          }}
        />
      ) : null}

      <Modal
        open={confirmOpen}
        title="Kirim Hitungan Fisik?"
        onCancel={() => setConfirmOpen(false)}
        footer={null}
        destroyOnClose
        centered
        width={480}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">
            Konfirmasi pengiriman hasil perhitungan fisik sesi {session?.code} ke
            Manajer Gudang.
          </Text>

          <div>
            <Text
              type="secondary"
              style={{ fontSize: 11, fontWeight: 700 }}
            >
              RINGKASAN ITEM TERHITUNG
            </Text>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {items.map((item) => (
                <li key={item.product_id}>
                  <Text>{buildSummaryLine(item, drafts)}</Text>
                </li>
              ))}
            </ul>
          </div>

          <Alert
            type="info"
            showIcon
            message="On-hand tidak akan berubah sampai manajer menyetujui."
          />

          <Flex justify="end" gap="small">
            <Button size="large" onClick={() => setConfirmOpen(false)}>
              Periksa Kembali
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              loading={submitMutation.isPending}
              onClick={handleSubmit}
            >
              Kirim
            </Button>
          </Flex>
        </Space>
      </Modal>
    </HitungLayout>
  )
}

export default HitungPage
