import React from 'react'
import { Button, Typography } from 'antd'
import { BuildOutlined, LogoutOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  clearSession,
  getSessionUser,
  logoutRequest,
} from 'helpers/auth_helper'
import { getRoleLabel } from 'constants/roles'
import styles from './AppHeader.module.css'

const { Text } = Typography

const AppHeader = ({
  title = 'Resto XYZ',
  subtitle = 'Modul Stock Opname',
  showUser = false,
  warehouseLabel = null,
}) => {
  const navigate = useNavigate()
  const user = showUser ? getSessionUser() : null

  const handleLogout = async () => {
    try {
      await logoutRequest()
    } catch (e) {
      // Still clear local session even if cookie clear fails.
    }
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.brandMark} aria-hidden>
          <BuildOutlined />
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandTitle}>{title}</span>
          <span className={styles.brandSubtitle}>{subtitle}</span>
        </div>
      </div>

      {showUser && user ? (
        <div className={styles.userArea}>
          <div className={styles.userMeta}>
            <Text strong className={styles.userName}>
              {user.name || user.email}
            </Text>
            <Text type="secondary" className={styles.userDetail}>
              {getRoleLabel(user.role)}
              {warehouseLabel ? ` · ${warehouseLabel}` : ''}
            </Text>
          </div>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            className={styles.logoutBtn}
          >
            Keluar
          </Button>
        </div>
      ) : null}
    </header>
  )
}

export default AppHeader
