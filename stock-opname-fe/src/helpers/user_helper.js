import { get, patch, post } from './requestor'
import { urlHelper } from './util'

const base = () => urlHelper.stockOpname.baseUrl

export function listUsers(params = {}) {
  return get(base() + urlHelper.stockOpname.users.list, { params })
}

export function createUser(payload) {
  return post(base() + urlHelper.stockOpname.users.create, payload)
}

export function updateUser(id, payload) {
  return patch(base() + urlHelper.stockOpname.users.update(id), payload)
}
