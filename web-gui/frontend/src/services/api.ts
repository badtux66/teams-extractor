import axios from 'axios'
import type { Message, HealthStatus, Stats } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

type RawMessage = Partial<Message> & {
  id?: number | string
  messageId?: string | null
  channelId?: string | null
  channel?: string | null
  author?: string | null
  authorEmail?: string | null
  text?: string | null
  message?: string | null
  preview?: string | null
  permalink?: string | null
  link?: string | null
  sender?: {
    id?: string | null
    name?: string | null
    email?: string | null
  } | null
  senderId?: string | null
  senderName?: string | null
  senderEmail?: string | null
  threadId?: string | null
  metadata_json?: unknown
  metadataJson?: unknown
  attachments_json?: unknown
  attachmentsJson?: unknown
  reactions_json?: unknown
  reactionsJson?: unknown
  createdAt?: string | null
  updatedAt?: string | null
  extractedAt?: string | null
  sentAt?: string | null
  sent_at?: string | null
  message_type?: string | null
  messageType?: string | null
  body?: { content?: string }
}

const firstValue = <T>(...values: Array<T | null | undefined | ''>): T | null => {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value as T
    }
  }
  return null
}

const firstString = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return null
}

const parseJson = <T>(value: unknown): T | null => {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  if (typeof value === 'object') {
    return value as T
  }
  return null
}

const parseArray = (value: unknown): unknown[] | null => {
  if (!value) return null
  if (Array.isArray(value)) return value
  const parsed = parseJson<unknown[]>(value)
  return Array.isArray(parsed) ? parsed : null
}

const getMetadataString = (
  metadata: Record<string, unknown> | null,
  ...keys: string[]
): string | null => {
  if (!metadata) return null
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return null
}

const normalizeMessage = (raw: RawMessage): Message => {
  const sender = raw.sender ?? null
  const metadata =
    parseJson<Record<string, unknown>>(raw.metadata) ??
    parseJson<Record<string, unknown>>(raw.metadata_json) ??
    parseJson<Record<string, unknown>>(raw.metadataJson) ??
    null

  const attachments =
    parseArray(raw.attachments) ??
    parseArray(raw.attachments_json) ??
    parseArray(raw.attachmentsJson) ??
    null

  const reactions =
    parseArray(raw.reactions) ??
    parseArray(raw.reactions_json) ??
    parseArray(raw.reactionsJson) ??
    null

  const messageId =
    firstString(raw.message_id, raw.messageId) ??
    (typeof raw.id === 'string' ? raw.id : null)

  const id = raw.id ?? messageId ?? ''

  const content =
    firstString(
      raw.content,
      raw.text,
      raw.message,
      raw.preview,
      raw.body?.content,
      getMetadataString(metadata, 'preview', 'previewText')
    ) ?? ''

  return {
    id,
    message_id: messageId,
    channel_id: firstValue(raw.channel_id, raw.channelId),
    channel_name:
      firstString(
        raw.channel_name,
        raw.channel,
        getMetadataString(metadata, 'channel', 'channelName')
      ),
    content,
    sender_id: firstValue(raw.sender_id, raw.senderId, sender?.id ?? null),
    sender_name:
      firstString(raw.sender_name, raw.senderName, raw.author, sender?.name) ?? null,
    sender_email:
      firstString(raw.sender_email, raw.senderEmail, raw.authorEmail, sender?.email) ?? null,
    timestamp:
      firstString(raw.timestamp, raw.sent_at, raw.sentAt, raw.created_at, raw.createdAt) ?? null,
    url: firstString(raw.url, raw.permalink, raw.link, getMetadataString(metadata, 'url')),
    type: firstString(raw.type, raw.message_type, raw.messageType) ?? 'message',
    thread_id: firstString(raw.thread_id, raw.threadId),
    attachments,
    reactions,
    metadata,
    extracted_at: firstString(raw.extracted_at, raw.extractedAt),
    created_at: firstString(raw.created_at, raw.createdAt),
    updated_at: firstString(raw.updated_at, raw.updatedAt),
  }
}

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
    const normalizedMessages = (data.messages || []).map(normalizeMessage)
    return {
      messages: normalizedMessages,
      total: typeof data.total === 'number' ? data.total : data.messages?.length ?? 0,
      limit: typeof data.limit === 'number' ? data.limit : data.messages?.length ?? 0,
      offset: typeof data.offset === 'number' ? data.offset : 0,
    }
  },

  getMessage: async (id: number | string): Promise<Message> => {
    const { data } = await api.get(`/messages/${id}`)
    return normalizeMessage(data.message || data)
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
