import { useQuery } from '@tanstack/react-query'
import { listAuditLogs } from 'helpers/audit_helper'

export function useAuditLogs(warehouseId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['audit-logs', warehouseId],
    queryFn: async () => {
      const rs = await listAuditLogs({ warehouseId })
      if (rs?.status === false) {
        throw new Error(rs.message || 'Gagal mengambil riwayat stok')
      }
      return rs?.data
    },
    enabled: Boolean(warehouseId) && enabled,
  })
}
