import React, { useEffect } from 'react'
import { Form, Input, Modal, Radio, App, Typography } from 'antd'
import { ExclamationCircleFilled } from '@ant-design/icons'
import { useWarehouseMutation } from 'hooks/useWarehouses'

const { Text } = Typography

const WarehouseModal = ({ open, warehouse, onClose }) => {
  const [form] = Form.useForm()
  const { message, modal } = App.useApp()
  const mutation = useWarehouseMutation()
  const isEdit = Boolean(warehouse?.id)

  useEffect(() => {
    if (!open) return

    if (warehouse) {
      form.setFieldsValue({
        code: warehouse.code,
        name: warehouse.name,
        description: warehouse.description || '',
        is_active: warehouse.is_active !== false,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ is_active: true })
    }
  }, [open, warehouse, form])

  const confirmDeactivateWithUsers = (assignedCount) =>
    new Promise((resolve) => {
      const preview = warehouse?.users_preview
        ? ` (${warehouse.users_preview})`
        : ''

      modal.confirm({
        title: 'Nonaktifkan gudang?',
        icon: <ExclamationCircleFilled />,
        content: (
          <div>
            <Text>
              Gudang <Text strong>{warehouse?.name || warehouse?.code}</Text>{' '}
              masih memiliki{' '}
              <Text strong>
                {assignedCount} pengguna
              </Text>
              {preview} dalam penugasan.
            </Text>
            <br />
            <br />
            <Text type="secondary">
              Me-nonaktifkan gudang akan memengaruhi akses operasional pengguna
              yang terikat pada gudang ini. Pastikan Anda memahami dampaknya
              sebelum melanjutkan.
            </Text>
          </div>
        ),
        okText: 'Ya, nonaktifkan',
        cancelText: 'Batal',
        okButtonProps: { danger: true },
        centered: true,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const wasActive = warehouse?.is_active !== false
      const willDeactivate = values.is_active === false
      const assignedCount = Number(warehouse?.user_count) || 0

      if (isEdit && wasActive && willDeactivate && assignedCount > 0) {
        const confirmed = await confirmDeactivateWithUsers(assignedCount)
        if (!confirmed) return
      }

      await mutation.mutateAsync({
        id: warehouse?.id,
        payload: {
          ...values,
          code: String(values.code || '').toUpperCase(),
        },
      })
      message.success('Data gudang berhasil disimpan')
      onClose()
    } catch (error) {
      if (error?.errorFields) return
      message.error(error?.message || 'Gagal menyimpan gudang')
    }
  }

  return (
    <Modal
      title={isEdit ? 'Ubah Data Gudang' : 'Gudang Baru'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Simpan Gudang"
      cancelText="Batal"
      confirmLoading={mutation.isPending}
      destroyOnClose
      centered
      styles={{
        body: {
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label="Kode Gudang"
          name="code"
          rules={[{ required: true, message: 'Kode wajib diisi' }]}
        >
          <Input
            placeholder="Contoh: WH-SBY"
            disabled={isEdit}
            style={{ textTransform: 'uppercase' }}
          />
        </Form.Item>
        <Form.Item
          label="Nama Gudang"
          name="name"
          rules={[{ required: true, message: 'Nama wajib diisi' }]}
        >
          <Input placeholder="Contoh: Gudang Surabaya" />
        </Form.Item>
        <Form.Item label="Fungsi / Deskripsi" name="description">
          <Input placeholder="Contoh: Depo Distribusi Regional" />
        </Form.Item>
        <Form.Item label="Status Operasional" name="is_active">
          <Radio.Group>
            <Radio value={true}>Aktif</Radio>
            <Radio value={false}>Nonaktif</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default WarehouseModal
