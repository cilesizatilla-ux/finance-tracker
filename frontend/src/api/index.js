import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ft_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const getTransactions = (params = {}) =>
  api.get('/transactions', { params })

export const createTransaction = (data) =>
  api.post('/transactions', data)

export const updateTransaction = (id, data) =>
  api.put(`/transactions/${id}`, data)

export const deleteTransaction = (id) =>
  api.delete(`/transactions/${id}`)

export const exportTransactions = (params = {}) =>
  api.get('/transactions/export', { params, responseType: 'blob' })

export const importCSV = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/transactions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const getCategories = (params = {}) =>
  api.get('/categories', { params })

export const getStatus = () =>
  api.get('/status')

export const createCategory = (data) =>
  api.post('/categories', data)

export const updateCategory = (id, data) =>
  api.put(`/categories/${id}`, data)

export const deleteCategory = (id) =>
  api.delete(`/categories/${id}`)

export const getCashflow = (months = 6) =>
  api.get('/reports/cashflow', { params: { months } })

export const getBudgetStatus = () =>
  api.get('/reports/budget')

export const sendChat = (message, history = []) =>
  api.post('/chat', { message, history })

export const runAnalysis = () =>
  api.post('/analyze')

export const register = (data) =>
  api.post('/auth/register', data)

export const loginApi = (data) =>
  api.post('/auth/login', data)

export const googleAuth = (credential) =>
  api.post('/auth/google', { credential })

// Parties
export const getParties = (params = {}) =>
  api.get('/parties', { params })

export const createParty = (data) =>
  api.post('/parties', data)

export const updateParty = (id, data) =>
  api.put(`/parties/${id}`, data)

export const deleteParty = (id) =>
  api.delete(`/parties/${id}`)

// Receipt extraction
export const extractReceipt = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/receipts/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// Report sharing
export const shareReport = (data) =>
  api.post('/reports/share', data)

export const getSharedReport = (token) =>
  api.get(`/shared/${token}`)

export const listShares = () =>
  api.get('/reports/shares')

export const deleteShare = (id) =>
  api.delete(`/reports/shares/${id}`)

export default api
