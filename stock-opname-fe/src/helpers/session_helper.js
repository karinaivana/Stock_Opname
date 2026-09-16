import { get, post } from './requestor'
import { urlHelper } from './util'

const base = () => urlHelper.stockOpname.baseUrl

export function listSessions() {
  return get(base() + urlHelper.stockOpname.sessions.list)
}

export function getSessionCandidates() {
  return get(base() + urlHelper.stockOpname.sessions.candidates)
}

export function createSession(payload) {
  return post(base() + urlHelper.stockOpname.sessions.create, payload)
}

export function getSession(id) {
  return get(base() + urlHelper.stockOpname.sessions.detail(id))
}

export function submitSessionCounts(id, payload) {
  return post(base() + urlHelper.stockOpname.sessions.counts(id), payload)
}

export function getSessionVariances(id) {
  return get(base() + urlHelper.stockOpname.sessions.variances(id))
}

export function approveSession(id) {
  return post(base() + urlHelper.stockOpname.sessions.approve(id), {})
}

export function rejectSession(id, payload = {}) {
  return post(base() + urlHelper.stockOpname.sessions.reject(id), payload)
}
