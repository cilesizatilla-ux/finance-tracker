import axios from 'axios'
import adminApi from '../admin/adminApi.js'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ft_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ft_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

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

export const getTransactionSummary = (params = {}) =>
  api.get('/transactions/summary', { params })

export const getTopCategories = (params = {}) =>
  api.get('/transactions/top-categories', { params })

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

export const getBudgetStatus = (params = {}) =>
  api.get('/reports/budget', { params })

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

export const getPartyStats = () =>
  api.get('/parties/stats')

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

export const getProfile = () => api.get('/auth/profile')
export const updateProfile = (data) => api.patch('/auth/profile', data)
export const changePassword = (payload) => api.post('/auth/change-password', payload)
export const exportUserData = () => api.get('/auth/export-data')

export const getNotifications = () => api.get('/auth/notifications')
export const markNotificationRead = (id) => api.post(`/auth/notifications/${id}/read`)

// Audit Calendar (user)
export const getAuditEntries = (params = {}) => api.get('/audit/entries', { params })
export const getAuditEntry = (id) => api.get(`/audit/entries/${id}`)
export const downloadAuditIcal = (id) => api.get(`/audit/entries/${id}/ical`, { responseType: 'blob' })
export const downloadAuditCalendar = () => api.get('/audit/calendar.ics', { responseType: 'blob' })
export const getMyExpenses = (params = {}) => api.get('/audit/my-expenses', { params })
export const submitExpense = (entryId, payload) => api.post(`/audit/entries/${entryId}/expenses`, payload)
export const updateExpense = (id, payload) => api.patch(`/audit/expenses/${id}`, payload)
export const deleteExpense = (id) => api.delete(`/audit/expenses/${id}`)

// Admin Audit Calendar
export const adminGetAuditEntries = (params = {}) => adminApi.get('/audit/entries', { params })
export const adminCreateAuditEntry = (payload) => adminApi.post('/audit/entries', payload)
export const adminUpdateAuditEntry = (id, payload) => adminApi.put(`/audit/entries/${id}`, payload)
export const adminDeleteAuditEntry = (id) => adminApi.delete(`/audit/entries/${id}`)
export const adminAssignAuditor = (entryId, payload) => adminApi.post(`/audit/entries/${entryId}/assign`, payload)
export const adminUnassignAuditor = (entryId, userId) => adminApi.delete(`/audit/entries/${entryId}/assign/${userId}`)
export const adminGetAllExpenses = (params = {}) => adminApi.get('/audit/expenses', { params })
export const adminReviewExpense = (id, payload) => adminApi.post(`/audit/expenses/${id}/review`, payload)
export const adminListUsers = (params = {}) => adminApi.get('/users', { params })

export default api
