import axios from 'axios'
import type { Message, HealthStatus, Stats } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export const healthApi = {
  getHealth: async (): Promise<HealthStatus> => {
    const { data } = await api.get('/health')
    return data
  },
}

export const messagesApi = {
  getMessages: async (params?: any): Promise<Message[]> => {
    const { data } = await api.get('/messages', { params })
    return data
  },

  getMessage: async (id: number): Promise<Message> => {
    const { data } = await api.get(`/messages/${id}`)
    return data
  },

  getStats: async (): Promise<Stats> => {
    const { data } = await api.get('/stats')
    return data
  },

  deleteMessage: async (id: number): Promise<void> => {
    await api.delete(`/messages/${id}`)
  },

  retryMessage: async (id: number): Promise<void> => {
    await api.post(`/messages/${id}/retry`)
  },
}

export const configApi = {
  getConfig: async (): Promise<any> => {
    const { data } = await api.get('/config')
    return data
  },

  updateConfig: async (config: any): Promise<void> => {
    await api.put('/config', config)
  },
}

export default api
