import { get, patch, post } from './requestor'
import { urlHelper } from './util'

const base = () => urlHelper.stockOpname.baseUrl

export function listProducts(params = {}) {
  return get(base() + urlHelper.stockOpname.products.list, { params })
}

export function getProduct(id) {
  return get(base() + urlHelper.stockOpname.products.detail(id))
}

export function createProduct(payload) {
  return post(base() + urlHelper.stockOpname.products.create, payload)
}

export function updateProduct(id, payload) {
  return patch(base() + urlHelper.stockOpname.products.update(id), payload)
}
