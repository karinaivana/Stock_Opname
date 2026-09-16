import React, { useEffect, useMemo } from 'react'
import {
  Button,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Typography,
  App,
} from 'antd'
import {
  BarcodeOutlined,
  DeleteOutlined,
  LockOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { BASE_UOM_OPTIONS } from 'constants/units'
import { useProduct, useProductMutation } from 'hooks/useProducts'
import SkuLayout from './SkuLayout'

const { Title, Text } = Typography

const baseCountType = (baseUom = '') => ({
  uom: baseUom,
  factor_to_base: 1,
  is_base: true,
})

const extraCountType = () => ({
  uom: '',
  factor_to_base: 1,
  is_base: false,
})

const formatQty = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '0'
  if (Number.isInteger(parsed)) return String(parsed)
  return parsed.toFixed(3).replace(/\.?0+$/, '')
}

const buildConversionExample = (baseUom, countTypes = []) => {
  const extras = (countTypes || []).slice(1).filter((item) => item?.uom)
  if (!baseUom || extras.length === 0) {
    return null
  }

  const primary = extras[0]
  const primaryQty = 3
  const baseQty = 10
  const total =
    primaryQty * Number(primary.factor_to_base || 0) +
    baseQty * 1

  const primaryLabel = primary.uom
  const equation = `${primaryQty} × ${formatQty(primary.factor_to_base)} + ${baseQty} × 1 = ${formatQty(total)}`

  return {
    summary: `Jika 1 ${primaryLabel} = ${formatQty(primary.factor_to_base)} ${baseUom}, maka ${primaryQty} ${primaryLabel} + ${baseQty} ${baseUom} = ${formatQty(total)} ${baseUom}.`,
    equation: `${equation} ${baseUom} (satuan dasar).`,
  }
}

const toFormValues = (product) => {
  const types = (product?.count_types || []).slice()
  const base = types.find((item) => item.is_base)
  const extras = types.filter((item) => !item.is_base)

  return {
    sku: product?.sku || '',
    name: product?.name || '',
    base_uom: product?.base_uom || undefined,
    is_active: product?.is_active !== false,
    count_types: [
      baseCountType(product?.base_uom || base?.uom || ''),
      ...extras.map((item) => ({
        uom: item.uom,
        factor_to_base: item.factor_to_base,
        is_base: false,
      })),
    ],
  }
}

const SkuForm = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const mutation = useProductMutation()
  const baseUom = Form.useWatch('base_uom', form)
  const countTypes = Form.useWatch('count_types', form) || []
  const conversionExample = useMemo(
    () => buildConversionExample(baseUom, countTypes),
    [baseUom, countTypes],
  )

  const { data: product, isLoading } = useProduct(id, { enabled: isEdit })

  useEffect(() => {
    if (isEdit) {
      if (!product) return
      form.setFieldsValue(toFormValues(product))
      return
    }

    form.setFieldsValue({
      sku: undefined,
      name: undefined,
      base_uom: undefined,
      is_active: true,
      count_types: [baseCountType()],
    })
  }, [form, isEdit, product])

  const syncBaseCountType = (nextBaseUom) => {
    const current = form.getFieldValue('count_types') || []
    const extras = current.slice(1)
    form.setFieldsValue({
      count_types: [baseCountType(nextBaseUom || ''), ...extras],
    })
  }

  const handleFinish = async (values) => {
    try {
      const payload = {
        sku: String(values.sku || '').toUpperCase(),
        name: values.name,
        base_uom: values.base_uom,
        is_active: values.is_active,
        count_types: (values.count_types || []).map((item, index) => ({
          uom: index === 0 ? values.base_uom : String(item.uom || '').trim(),
          factor_to_base: index === 0 ? 1 : item.factor_to_base,
          is_base: index === 0,
          sort_order: index,
        })),
      }

      await mutation.mutateAsync({
        id: isEdit ? id : undefined,
        payload,
      })
      message.success('Data SKU berhasil disimpan')
      navigate('/inventori/sku')
    } catch (error) {
      if (error?.errorFields) return
      message.error(error?.message || 'Gagal menyimpan SKU')
    }
  }

  return (
    <SkuLayout selectedKey="sku">
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          SKU
          <Text style={{ margin: '0 8px' }} type="secondary">
            /
          </Text>
          <Text strong>{isEdit ? 'Ubah SKU' : 'SKU baru'}</Text>
        </Text>
      </div>

      <Flex
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap="middle"
        style={{ marginBottom: 10 }}
      >
        <div>
          <Title level={2}>
            {isEdit ? 'Ubah Stock Keeping Unit' : 'Tambah Stock Keeping Unit'}
          </Title>
        </div>
      </Flex>

      {isEdit && isLoading ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          {conversionExample ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e2db',
                borderRadius: 8,
                padding: 24,
              }}
            >
              <Title level={5} style={{ marginTop: 0 }}>
                Contoh konversi
              </Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Text style={{ fontSize: 16, lineHeight: 1.6 }}>
                  {conversionExample.summary}
                </Text>
                <Text
                  code
                  style={{
                    display: 'block',
                    whiteSpace: 'normal',
                    fontSize: 14,
                    padding: '12px 16px',
                    background: '#f6f3ec',
                  }}
                >
                  {conversionExample.equation}
                </Text>
              </Space>
            </div>
          ) : null}

          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e2db',
              borderRadius: 8,
              padding: 24,
            }}
          >
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={handleFinish}
              disabled={mutation.isPending}
            >
            <Space align="center" style={{ marginBottom: 16 }}>
              <span
                style={{
                  width: 6,
                  height: 16,
                  background: '#bc0006',
                  borderRadius: 99,
                  display: 'inline-block',
                }}
              />
              <Title level={5} style={{ margin: 0 }}>
                IDENTITAS
              </Title>
              <Text
                type="secondary"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}
              >
                WAJIB DIISI
              </Text>
            </Space>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Kode Stock Keeping Unit (SKU)"
                  name="sku"
                  normalize={(value) => String(value || '').toUpperCase()}
                  rules={[{ required: true, message: 'Kode Stock Keeping Unit (SKU) wajib diisi' }]}
                >
                  <Input
                    prefix={<BarcodeOutlined />}
                    placeholder="CONTOH-SKU-001"
                    disabled={isEdit}
                    style={{ textTransform: 'uppercase' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Nama Barang"
                  name="name"
                  rules={[{ required: true, message: 'Nama Barang wajib diisi' }]}
                >
                  <Input placeholder="Masukkan Deskripsi Barang" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Satuan Dasar"
                  name="base_uom"
                  rules={[{ required: true, message: 'Satuan Dasar wajib dipilih' }]}
                >
                  <Select
                    options={BASE_UOM_OPTIONS}
                    placeholder="Pilih Satuan Dasar"
                    onChange={syncBaseCountType}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Status"
                  name="is_active"
                >
                  <Radio.Group>
                    <Radio value={true}>Aktif</Radio>
                    <Radio value={false}>Nonaktif</Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>

            <Space align="center" style={{ margin: '8px 0 4px' }}>
              <span
                style={{
                  width: 6,
                  height: 16,
                  background: '#bc0006',
                  borderRadius: 99,
                  display: 'inline-block',
                }}
              />
              <Title level={5} style={{ margin: 0 }}>
                TIPE HITUNGAN
              </Title>
            </Space>

            <div
              style={{
                border: '1px solid #e5e2db',
                borderRadius: 8,
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <Row
                gutter={16}
                style={{
                  background: '#f6f3ec',
                  padding: '8px 16px',
                  margin: 0,
                }}
              >
                <Col span={9}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>
                    NAMA SATUAN
                  </Text>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>
                    FAKTOR KONVERSI KE SATUAN DASAR
                  </Text>
                </Col>
                <Col span={5}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>
                    SATUAN DASAR
                  </Text>
                </Col>
                <Col span={2} />
              </Row>

              <Form.List name="count_types">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => {
                      const isBase = field.name === 0

                      return (
                        <Row
                          key={field.key}
                          gutter={16}
                          align="middle"
                          style={{
                            padding: '12px 16px 0',
                            margin: 0,
                            borderTop: '1px solid #e5e2db',
                          }}
                        >
                          <Col span={9}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'uom']}
                              rules={
                                isBase
                                  ? []
                                  : [
                                      {
                                        required: true,
                                        message: 'Nama satuan wajib diisi',
                                      },
                                      {
                                        validator: async (_, value) => {
                                          const unit = String(value || '')
                                            .trim()
                                            .toLowerCase()
                                          if (!unit) return
                                          if (baseUom && unit === baseUom) {
                                            throw new Error(
                                              'Nama satuan tidak boleh sama dengan satuan dasar'
                                            )
                                          }
                                          const others = (form.getFieldValue('count_types') || [])
                                            .map((item, index) => ({
                                              uom: String(item?.uom || '')
                                                .trim()
                                                .toLowerCase(),
                                              index,
                                            }))
                                            .filter(
                                              (item) =>
                                                item.index !== field.name && item.uom
                                            )
                                          if (others.some((item) => item.uom === unit)) {
                                            throw new Error('Nama satuan harus unik')
                                          }
                                        },
                                      },
                                    ]
                              }
                            >
                              <Input
                                prefix={isBase ? <LockOutlined /> : null}
                                disabled={isBase}
                                placeholder={isBase ? baseUom || 'Satuan dasar' : 'Nama kemasan'}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'factor_to_base']}
                              rules={
                                isBase
                                  ? []
                                  : [
                                      {
                                        required: true,
                                        message: 'Faktor wajib diisi',
                                      },
                                    ]
                              }
                            >
                              <InputNumber
                                min={0.001}
                                step={1}
                                precision={3}
                                disabled={isBase}
                                style={{ width: '100%' }}
                                addonAfter={baseUom || 'satuan'}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={5} style={{ paddingBottom: 24 }}>
                            {isBase ? (
                              <Text type="danger" style={{ fontWeight: 700 }}>
                                DASAR
                              </Text>
                            ) : (
                              <Text type="secondary">-</Text>
                            )}
                          </Col>
                          <Col span={2} style={{ paddingBottom: 24, textAlign: 'right' }}>
                            {!isBase ? (
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(field.name)}
                              />
                            ) : null}
                          </Col>
                        </Row>
                      )
                    })}

                    <Flex
                      justify="space-between"
                      align="center"
                      style={{ padding: 16, borderTop: '1px solid #e5e2db' }}
                    >
                      <Button
                        type="text"
                        icon={<PlusCircleOutlined />}
                        onClick={() => add(extraCountType())}
                      >
                        Tambah Tipe Hitungan
                      </Button>
                    </Flex>
                  </>
                )}
              </Form.List>
            </div>

                <Flex justify="flex-end" gap="small">
                  <Button onClick={() => navigate('/inventori/sku')}>Batal</Button>
                  <Button type="primary" htmlType="submit" loading={mutation.isPending}>
                    Simpan SKU
                  </Button>
                </Flex>
              </Form>
            </div>
        </Space>
      )}
    </SkuLayout>
  )
}

export default SkuForm
