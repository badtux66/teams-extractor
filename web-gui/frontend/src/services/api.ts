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

type MessageListResponse = {
  messages: Message[]
  total: number
  limit: number
  offset: number
}

export const messagesApi = {
  getMessages: async (params?: Record<string, unknown>): Promise<MessageListResponse> => {
    const { data } = await api.get('/messages', { params })
    return {
      messages: data.messages || [],
      total: typeof data.total === 'number' ? data.total : data.messages?.length ?? 0,
      limit: typeof data.limit === 'number' ? data.limit : data.messages?.length ?? 0,
      offset: typeof data.offset === 'number' ? data.offset : 0,
    }
  },

  getMessage: async (id: number | string): Promise<Message> => {
    const { data } = await api.get(`/messages/${id}`)
    return data.message || data
  },

  getStats: async (): Promise<Stats> => {
    const { data } = await api.get('/stats')
    return data.stats || data
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
