import axios from 'axios'

const axiosApi = axios.create({
  baseURL: '',
  withCredentials: true,
})

axiosApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

export async function get(url, config = {}) {
  return axiosApi.get(url, config).then((response) => response.data)
}

export async function post(url, data, config = {}) {
  return axiosApi.post(url, data, config).then((response) => response.data)
}

export async function put(url, data, config = {}) {
  return axiosApi.put(url, data, config).then((response) => response.data)
}

export async function patch(url, data, config = {}) {
  return axiosApi.patch(url, data, config).then((response) => response.data)
}

export async function del(url, config = {}) {
  return axiosApi.delete(url, config).then((response) => response.data)
}
