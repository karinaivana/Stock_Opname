import { get, patch, post } from './requestor'
import { urlHelper } from './util'

const base = () => urlHelper.stockOpname.baseUrl

export function listWarehouses(params = {}) {
  return get(base() + urlHelper.stockOpname.warehouses.list, { params })
}

export function createWarehouse(payload) {
  return post(base() + urlHelper.stockOpname.warehouses.create, payload)
}

export function updateWarehouse(id, payload) {
  return patch(base() + urlHelper.stockOpname.warehouses.update(id), payload)
}
