import { create } from 'zustand'
import type { Message, HealthStatus, Stats } from '../types'

interface AppState {
  // Theme
  darkMode: boolean
  toggleDarkMode: () => void

  // Messages
  messages: Message[]
  selectedMessage: Message | null
  setMessages: (messages: Message[]) => void
  setSelectedMessage: (message: Message | null) => void

  // Health & Stats
  health: HealthStatus | null
  stats: Stats | null
  setHealth: (health: HealthStatus) => void
  setStats: (stats: Stats) => void

  // UI State
  loading: boolean
  error: string | null
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  // Theme
  darkMode: false,
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

  // Messages
  messages: [],
  selectedMessage: null,
  setMessages: (messages) => set({ messages }),
  setSelectedMessage: (selectedMessage) => set({ selectedMessage }),

  // Health & Stats
  health: null,
  stats: null,
  setHealth: (health) => set({ health }),
  setStats: (stats) => set({ stats }),

  // UI State
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
