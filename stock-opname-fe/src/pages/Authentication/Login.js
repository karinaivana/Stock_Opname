import React, { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import {
  ArrowRightOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppHeader from 'components/AppHeader/AppHeader'
import { getHomePath } from 'constants/roles'
import { getSessionUser } from 'helpers/auth_helper'
import { getLoginErrorMessage, useLogin } from 'hooks/useLogin'

const { Title } = Typography

const Login = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const loginMutation = useLogin()
  const [formError, setFormError] = useState(null)

  const onFinish = (values) => {
    setFormError(null)

    loginMutation.mutate(values, {
      onSuccess: (data) => {
        const user = data?.user || getSessionUser()
        const home = getHomePath(user?.role)
        navigate(redirect || home, { replace: true })
      },
      onError: (error) => {
        setFormError(getLoginErrorMessage(error))
      },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fcf9f2' }}>
      <AppHeader />

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Card style={{ width: '100%', maxWidth: 460 }}>
          <Title level={2} style={{ marginTop: 0 }}>
            Stock Opname
          </Title>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            disabled={loginMutation.isPending}
          >
            <Form.Item
              label="Alamat Email"
              name="email"
              rules={[
                { required: true, message: 'Email wajib diisi' },
                { type: 'email', message: 'Format email tidak valid' },
              ]}
            >
              <Input
                autoComplete="email"
                placeholder="example@gmail.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Kata Sandi"
              name="password"
              rules={[{ required: true, message: 'Kata sandi wajib diisi' }]}
            >
              <Input.Password
                autoComplete="current-password"
                placeholder="Masukkan kata sandi"
                size="large"
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: formError ? 16 : 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loginMutation.isPending}
              >
                Masuk
              </Button>
            </Form.Item>
          </Form>

          {formError ? (
            <Alert type="error" showIcon message={formError} />
          ) : null}
        </Card>
      </div>
    </div>
  )
}

export default Login
