import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
} from 'helpers/product_helper'

const DEFAULT_PAGE_SIZE = 10

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

async function fetchProducts(params) {
  const rs = await listProducts(params)
  if (rs?.status === false) {
    throw new Error(rs.message || 'Gagal mengambil data SKU')
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

export function useProducts({
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  q = '',
  status = 'ALL',
  baseUom = '',
  sort = 'sku',
  order = 'asc',
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: ['products', { page, limit, q, status, baseUom, sort, order }],
    queryFn: () =>
      fetchProducts({
        page,
        limit,
        q,
        status,
        base_uom: baseUom || undefined,
        sort,
        order,
      }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useProduct(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: async () => {
      const rs = await getProduct(id)
      if (rs?.status === false) {
        throw new Error(rs.message || 'Gagal mengambil detail SKU')
      }
      return rs?.data
    },
    enabled: Boolean(id) && enabled,
  })
}

export function useProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }) => {
      try {
        const rs = id
          ? await updateProduct(id, payload)
          : await createProduct(payload)

        if (rs && rs.status === false) {
          throw new Error(rs.message || 'Gagal menyimpan SKU')
        }

        return rs?.data
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Gagal menyimpan SKU'))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
