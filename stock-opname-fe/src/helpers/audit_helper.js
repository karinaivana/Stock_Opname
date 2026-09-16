import { get } from './requestor'
import { urlHelper } from './util'

const base = () => urlHelper.stockOpname.baseUrl

export function listAuditLogs(params = {}) {
  return get(base() + urlHelper.stockOpname.auditLogs.list, { params })
}
