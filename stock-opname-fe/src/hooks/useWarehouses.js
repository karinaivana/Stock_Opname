import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWarehouse,
  listWarehouses,
  updateWarehouse,
} from 'helpers/warehouse_helper'

const DEFAULT_PAGE_SIZE = 10

async function fetchWarehouses(params) {
  const rs = await listWarehouses(params)
  if (rs?.status === false) {
    throw new Error(rs.message || 'Gagal mengambil data gudang')
  }

  const data = rs?.data
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: params.page || 1,
      limit: params.limit || DEFAULT_PAGE_SIZE,
    }
  }

  return {
    items: data?.items || [],
    total: data?.total || 0,
    page: data?.page || params.page || 1,
    limit: data?.limit || params.limit || DEFAULT_PAGE_SIZE,
  }
}

export function useWarehouses({
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  q = '',
  status = 'ALL',
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: ['warehouses', { page, limit, q, status }],
    queryFn: () => fetchWarehouses({ page, limit, q, status }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useWarehouseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const rs = id
        ? await updateWarehouse(id, payload)
        : await createWarehouse(payload)

      if (rs && rs.status === false) {
        throw new Error(rs.message || 'Gagal menyimpan gudang')
      }

      return rs?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })
}
