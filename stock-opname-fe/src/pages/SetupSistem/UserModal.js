import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, Modal, Radio, Select, App } from 'antd'
import { ROLES, getRoleLabel, ROLE_OPTIONS_LIST} from 'constants/roles'
import { useUserMutation } from 'hooks/useUsers'

const ROLE_OPTIONS = ROLE_OPTIONS_LIST.map((value) => ({ value, label: getRoleLabel(value) }))

const needsWarehouse = (role) =>
  role === ROLES.WAREHOUSE_STAFF || role === ROLES.WAREHOUSE_MANAGER

const UserModal = ({ open, user, warehouses = [], onClose }) => {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const mutation = useUserMutation()
  const isEdit = Boolean(user?.id)
  const role = Form.useWatch('role', form)
  const showWarehouse = needsWarehouse(role)
  const [lockAutofill, setLockAutofill] = useState(true)

  const warehouseOptions = useMemo(
    () =>
      (warehouses || [])
        .filter((w) => w.is_active !== false)
        .map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
    [warehouses],
  )

  useEffect(() => {
    if (!open) return

    setLockAutofill(true)

    if (user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        role: user.role,
        warehouse_id: user.warehouse_id || undefined,
        is_active: user.is_active !== false,
        password: undefined,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        name: undefined,
        email: undefined,
        role: undefined,
        warehouse_id: undefined,
        password: undefined,
        is_active: true,
      })
    }
  }, [open, user, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        name: values.name,
        email: values.email,
        role: values.role,
        is_active: values.is_active,
        warehouse_id: showWarehouse ? values.warehouse_id : null,
      }

      if (values.password) {
        payload.password = values.password
      }

      await mutation.mutateAsync({ id: user?.id, payload })
      message.success('Data pengguna berhasil disimpan')
      onClose()
    } catch (error) {
      if (error?.errorFields) return
      message.error(error?.message || 'Gagal menyimpan pengguna')
    }
  }

  return (
    <Modal
      title={isEdit ? 'Ubah Otorisasi Pengguna' : 'Pengguna Baru'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Simpan Pengguna"
      cancelText="Batal"
      confirmLoading={mutation.isPending}
      destroyOnClose
      width={520}
      centered
      styles={{
        body: {
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
    >
      <Form form={form} layout="vertical" requiredMark={false} autoComplete="off">
        <Form.Item
          label="Nama"
          name="name"
          rules={[{ required: true, message: 'Nama wajib diisi' }]}
        >
          <Input placeholder="Nama Lengkap" autoComplete="off" />
        </Form.Item>
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Email wajib diisi' },
            { type: 'email', message: 'Format email tidak valid' },
          ]}
        >
          <Input
            placeholder="example@gmail.com"
            autoComplete="off"
            readOnly={!isEdit && lockAutofill}
            onMouseDown={() => setLockAutofill(false)}
            onFocus={() => setLockAutofill(false)}
          />
        </Form.Item>
        <Form.Item
          label="Peran"
          name="role"
          rules={[{ required: true, message: 'Peran wajib dipilih' }]}
        >
          <Select
            options={ROLE_OPTIONS}
            placeholder="Pilih Peran"
            allowClear
          />
        </Form.Item>
        {showWarehouse ? (
          <Form.Item
            label="Gudang Penugasan"
            name="warehouse_id"
            rules={[{ required: true, message: 'Gudang wajib dipilih' }]}
            extra="Peran operasional wajib terikat pada 1 gudang."
          >
            <Select
              options={warehouseOptions}
              placeholder="Pilih Gudang"
              allowClear
            />
          </Form.Item>
        ) : role ? (
          <Form.Item extra="Peran tingkat sistem memiliki cakupan global.">
            <Input value="Semua Gudang" disabled />
          </Form.Item>
        ) : null}
        <Form.Item
          label={isEdit ? 'Kata Sandi Baru (opsional)' : 'Kata Sandi'}
          name="password"
          rules={
            isEdit
              ? []
              : [{ required: true, message: 'Kata sandi wajib diisi' }]
          }
        >
          <Input.Password
            placeholder="Masukkan Kata Sandi"
            autoComplete="new-password"
            readOnly={lockAutofill}
            onMouseDown={() => setLockAutofill(false)}
            onFocus={() => setLockAutofill(false)}
          />
        </Form.Item>
        <Form.Item label="Status" name="is_active">
          <Radio.Group>
            <Radio value={true}>Aktif</Radio>
            <Radio value={false}>Nonaktif</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default UserModal
