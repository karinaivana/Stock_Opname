import { post } from './requestor'
import { STORAGE_USER_KEY, urlHelper } from './util'

export function loginRequest({ email, password }) {
  const url =
    urlHelper.stockOpname.baseUrl + urlHelper.stockOpname.auth.login

  return post(url, { email, password })
}

export function logoutRequest() {
  const url =
    urlHelper.stockOpname.baseUrl + urlHelper.stockOpname.auth.logout

  return post(url, {})
}

export function setSession(user) {
  window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_USER_KEY)
}

export function getSessionUser() {
  const raw = window.localStorage.getItem(STORAGE_USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
