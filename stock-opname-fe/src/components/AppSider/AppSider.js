import React, { useState } from 'react'
import { Button, Flex, Layout, Menu, Typography } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'

const { Sider } = Layout
const { Text } = Typography

const AppSider = ({
  title,
  extra = null,
  selectedKey,
  items = [],
  width = 240,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  const toggle = () => setCollapsed((prev) => !prev)

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      breakpoint="lg"
      collapsedWidth={80}
      width={width}
      theme="light"
      style={{ background: '#fff', borderRight: '1px solid #e5e2db' }}
    >
      <Flex
        align="center"
        justify={collapsed ? 'center' : 'space-between'}
        gap={8}
        style={{ padding: collapsed ? '12px 8px' : '12px 12px 8px 16px' }}
      >
        {!collapsed && title ? (
          <Text
            type="secondary"
            style={{
              fontSize: 11,
              fontWeight: 700,
              flex: 1,
              minWidth: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </Text>
        ) : null}
        <Button
          type="text"
          size="small"
          aria-label={collapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggle}
          style={{
            color: '#625d5b',
            border: '1px solid #e5e2db',
            borderRadius: 6,
            width: 28,
            height: 28,
            flexShrink: 0,
          }}
        />
      </Flex>
      {!collapsed && extra ? (
        <div style={{ padding: '0 16px 8px' }}>{extra}</div>
      ) : null}
      <Menu mode="inline" selectedKeys={[selectedKey]} items={items} />
    </Sider>
  )
}

export default AppSider
