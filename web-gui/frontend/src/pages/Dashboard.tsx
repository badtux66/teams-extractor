import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  Pending,
  TrendingUp,
} from '@mui/icons-material'
import { messagesApi, healthApi } from '../services/api'
import { useStore } from '../store/useStore'
import type { Stats, HealthStatus } from '../types'

export default function Dashboard() {
  const [stats, setStatsLocal] = useState<Stats | null>(null)
  const [health, setHealthLocal] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [statsData, healthData] = await Promise.all([
        messagesApi.getStats(),
        healthApi.getHealth(),
      ])
      setStatsLocal(statsData)
      setHealthLocal(healthData)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error && !stats) {
    return <Alert severity="error">{error}</Alert>
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Health Status */}
      {health && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Health
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary">Status:</Typography>
                  <Chip
                    label={health.status}
                    color={health.status === 'ok' ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Model: <strong>{health.model}</strong>
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary">n8n:</Typography>
                  <Chip
                    label={health.n8n_connected ? 'Connected' : 'Disconnected'}
                    color={health.n8n_connected ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  DB: {health.db}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4">{stats.total_messages}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Messages
                    </Typography>
                  </Box>
                  <TrendingUp color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" color="success.main">{stats.processed}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Processed
                    </Typography>
                  </Box>
                  <CheckCircle color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" color="warning.main">{stats.pending}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending
                    </Typography>
                  </Box>
                  <Pending color="warning" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" color="error.main">{stats.failed}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed
                    </Typography>
                  </Box>
                  <Error color="error" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Today
                </Typography>
                <Typography variant="h3">{stats.today}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Messages processed today
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  This Week
                </Typography>
                <Typography variant="h3">{stats.this_week}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Messages processed this week
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
