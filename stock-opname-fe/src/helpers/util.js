export const urlHelper = {
  stockOpname: {
    baseUrl: process.env.REACT_APP_API_BASE_URL || '',
    auth: {
      login: '/auth/login',
      logout: '/auth/logout',
      me: '/auth/me',
    },
    warehouses: {
      list: '/warehouses',
      create: '/warehouses',
      update: (id) => `/warehouses/${id}`,
    },
    users: {
      list: '/users',
      create: '/users',
      update: (id) => `/users/${id}`,
    },
    products: {
      list: '/products',
      create: '/products',
      detail: (id) => `/products/${id}`,
      update: (id) => `/products/${id}`,
    },
    inventory: {
      byWarehouse: (warehouseId) => `/inventory/${warehouseId}`,
      setOpening: (warehouseId) => `/inventory/${warehouseId}`,
    },
    sessions: {
      list: '/sessions',
      candidates: '/sessions/candidates',
      create: '/sessions',
      detail: (id) => `/sessions/${id}`,
      counts: (id) => `/sessions/${id}/counts`,
      variances: (id) => `/sessions/${id}/variances`,
      approve: (id) => `/sessions/${id}/approve`,
      reject: (id) => `/sessions/${id}/reject`,
    },
    auditLogs: {
      list: '/audit-logs',
    },
  },
}

export const STORAGE_USER_KEY = 'soUser'

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

/** Example: 15 September 2026, 10:39AM */
export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const day = date.getDate()
  const month = MONTHS_ID[date.getMonth()]
  const year = date.getFullYear()

  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12

  return `${day} ${month} ${year}, ${hours}:${minutes}${ampm}`
}
