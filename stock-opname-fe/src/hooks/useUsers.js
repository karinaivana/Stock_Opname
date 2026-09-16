import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, listUsers, updateUser } from 'helpers/user_helper'

const DEFAULT_PAGE_SIZE = 10

async function fetchUsers(params) {
  const rs = await listUsers(params)
  if (rs?.status === false) {
    throw new Error(rs.message || 'Gagal mengambil data pengguna')
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

export function useUsers({
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  q = '',
  role = 'ALL',
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: ['users', { page, limit, q, role }],
    queryFn: () =>
      fetchUsers({
        page,
        limit,
        q,
        role: role === 'ALL' ? undefined : role,
      }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const rs = id
        ? await updateUser(id, payload)
        : await createUser(payload)

      if (rs && rs.status === false) {
        throw new Error(rs.message || 'Gagal menyimpan pengguna')
      }

      return rs?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })
}
