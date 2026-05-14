import axios from 'axios'

const adminApi = axios.create({ baseURL: '/api/v1/admin', headers: { 'Content-Type': 'application/json' } })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('ft_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ft_admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

export default adminApi
