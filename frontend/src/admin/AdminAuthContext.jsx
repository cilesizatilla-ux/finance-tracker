import { createContext, useContext, useState, useEffect } from 'react'
import adminApi from './adminApi.js'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('ft_admin_token')
    if (!token) {
      setLoading(false)
      return
    }
    adminApi.get('/auth/me')
      .then((res) => {
        setAdmin(res.data?.data || res.data)
      })
      .catch(() => {
        localStorage.removeItem('ft_admin_token')
        setAdmin(null)
      })
      .finally(() => setLoading(false))
  }, [])

  function adminLogin(token, adminData) {
    localStorage.setItem('ft_admin_token', token)
    setAdmin(adminData)
  }

  function adminLogout() {
    localStorage.removeItem('ft_admin_token')
    setAdmin(null)
  }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, adminLogin, adminLogout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminAuthContext)
}
