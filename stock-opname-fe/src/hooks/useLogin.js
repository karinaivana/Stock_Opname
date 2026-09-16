import { useMutation } from '@tanstack/react-query'
import { loginRequest, setSession } from 'helpers/auth_helper'

export function useLogin() {
  return useMutation({
    mutationKey: ['auth', 'login'],
    mutationFn: async (payload) => {
      const rs = await loginRequest(payload)

      if (!rs?.status) {
        const error = new Error(rs?.message || 'Email atau kata sandi salah')
        error.statusCode = 400
        throw error
      }

      if (rs.data?.user) {
        setSession(rs.data.user)
      }

      return rs.data
    },
  })
}

export function getLoginErrorMessage(error) {
  const statusCode = error?.response?.status || error?.statusCode
  const apiMessage = error?.response?.data?.message

  if (statusCode === 401 || statusCode === 400) {
    return 'Email atau kata sandi salah'
  }

  if (statusCode === 501) {
    return 'Login belum tersedia di server. Coba lagi nanti.'
  }

  return apiMessage || error?.message || 'Email atau kata sandi salah'
}
