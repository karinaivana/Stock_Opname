import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { STORAGE_USER_KEY } from 'helpers/util'
import { getHomePath } from 'constants/roles'

const Authmiddleware = ({ children, route }) => {
  const location = useLocation()
  const rawUser = window.localStorage.getItem(STORAGE_USER_KEY)

  if (!rawUser) {
    const refUrl = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(refUrl)}`}
        replace
      />
    )
  }

  let soUser = null
  try {
    soUser = JSON.parse(rawUser)
  } catch (e) {
    return <Navigate to="/login" replace />
  }

  if (route?.role?.length > 0) {
    const userRole = soUser?.role
    if (!route.role.includes(userRole)) {
      return <Navigate to={getHomePath(userRole)} replace />
    }
  }

  return <>{children}</>
}

export default Authmiddleware
