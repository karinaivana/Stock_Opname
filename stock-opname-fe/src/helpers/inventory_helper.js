import { get, put } from './requestor'
import { urlHelper } from './util'

const base = () => urlHelper.stockOpname.baseUrl

export function getInventoryByWarehouse(warehouseId) {
  return get(base() + urlHelper.stockOpname.inventory.byWarehouse(warehouseId))
}

export function setOpeningStock(warehouseId, payload) {
  return put(
    base() + urlHelper.stockOpname.inventory.setOpening(warehouseId),
    payload
  )
}
