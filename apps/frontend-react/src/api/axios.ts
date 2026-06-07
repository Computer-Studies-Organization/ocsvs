import axios from 'axios'
import { handleUnauthorizedResponse } from '@/lib/authRedirect'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipUnauthorizedRedirect?: boolean
  }

  interface InternalAxiosRequestConfig {
    skipUnauthorizedRedirect?: boolean
  }
}

export const api = axios.create({
  baseURL: 'http://localhost:8787',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  else {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

api.interceptors.response.use(
  response => response,
  async (error) => {
    await handleUnauthorizedResponse({
      skipUnauthorizedRedirect: error.config?.skipUnauthorizedRedirect,
      status: error.response?.status,
    })
    return Promise.reject(error)
  },
)
