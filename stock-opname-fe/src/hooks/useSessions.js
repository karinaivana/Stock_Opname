import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveSession,
  createSession,
  getSession,
  getSessionCandidates,
  getSessionVariances,
  listSessions,
  rejectSession,
  submitSessionCounts,
} from 'helpers/session_helper'

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

export function useSessions({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const rs = await listSessions()
      if (rs?.status === false) {
        throw new Error(rs.message || 'Gagal mengambil daftar sesi')
      }
      return rs?.data
    },
    enabled,
  })
}

export function useSessionCandidates({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['sessions', 'candidates'],
    queryFn: async () => {
      const rs = await getSessionCandidates()
      if (rs?.status === false) {
        throw new Error(rs.message || 'Gagal mengambil kandidat SKU')
      }
      return rs?.data
    },
    enabled,
  })
}

export function useSession(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['sessions', 'detail', id],
    queryFn: async () => {
      const rs = await getSession(id)
      if (rs?.status === false) {
        throw new Error(rs.message || 'Gagal mengambil detail sesi')
      }
      return rs?.data
    },
    enabled: Boolean(id) && enabled,
  })
}

export function useSessionVariances(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['sessions', 'variances', id],
    queryFn: async () => {
      const rs = await getSessionVariances(id)
      if (rs?.status === false) {
        throw new Error(rs.message || 'Gagal mengambil data selisih')
      }
      return rs?.data
    },
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload) => {
      try {
        const rs = await createSession(payload)
        if (rs && rs.status === false) {
          throw new Error(rs.message || 'Gagal membuat sesi')
        }
        return rs?.data
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Gagal membuat sesi'))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export function useSubmitCountsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, items }) => {
      try {
        const rs = await submitSessionCounts(sessionId, { items })
        if (rs && rs.status === false) {
          throw new Error(rs.message || 'Gagal mengirim hitungan')
        }
        return rs?.data
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Gagal mengirim hitungan'))
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({
        queryKey: ['sessions', 'detail', variables.sessionId],
      })
    },
  })
}

export function useApproveSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId) => {
      try {
        const rs = await approveSession(sessionId)
        if (rs && rs.status === false) {
          throw new Error(rs.message || 'Gagal menyetujui sesi')
        }
        return rs?.data
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Gagal menyetujui sesi'))
      }
    },
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({
        queryKey: ['sessions', 'variances', sessionId],
      })
      queryClient.invalidateQueries({
        queryKey: ['sessions', 'detail', sessionId],
      })
    },
  })
}

export function useRejectSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, reason }) => {
      try {
        const rs = await rejectSession(sessionId, { reason })
        if (rs && rs.status === false) {
          throw new Error(rs.message || 'Gagal menolak sesi')
        }
        return rs?.data
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Gagal menolak sesi'))
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({
        queryKey: ['sessions', 'variances', variables.sessionId],
      })
      queryClient.invalidateQueries({
        queryKey: ['sessions', 'detail', variables.sessionId],
      })
    },
  })
}
