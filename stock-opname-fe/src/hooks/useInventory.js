import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInventoryByWarehouse,
  setOpeningStock,
} from 'helpers/inventory_helper'

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

export function useInventory(warehouseId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['inventory', warehouseId],
    queryFn: async () => {
      const rs = await getInventoryByWarehouse(warehouseId)
      if (rs?.status === false) {
        throw new Error(rs.message || 'Gagal mengambil data stok awal')
      }
      return rs?.data
    },
    enabled: Boolean(warehouseId) && enabled,
  })
}

export function useOpeningStockMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ warehouseId, items }) => {
      try {
        const rs = await setOpeningStock(warehouseId, { items })
        if (rs && rs.status === false) {
          throw new Error(rs.message || 'Gagal menyimpan stok awal')
        }
        return rs?.data
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Gagal menyimpan stok awal'))
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['inventory', variables.warehouseId],
      })
    },
  })
}
