import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material'
import { Save } from '@mui/icons-material'
import { configApi } from '../services/api'

interface Config {
  openai_api_key: string
  n8n_webhook_url: string
  n8n_api_key: string
  processor_host: string
  processor_port: number
  auto_retry: boolean
  max_retries: number
}

export default function Settings() {
  const [config, setConfig] = useState<Config>({
    openai_api_key: '',
    n8n_webhook_url: '',
    n8n_api_key: '',
    processor_host: '0.0.0.0',
    processor_port: 8090,
    auto_retry: true,
    max_retries: 3,
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const data = await configApi.getConfig()
      setConfig(data)
    } catch (err: any) {
      // Config might not exist yet
      console.error('Failed to load config:', err)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      setSuccess(false)
      setError(null)
      await configApi.updateConfig(config)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof Config) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.type === 'number'
        ? parseInt(event.target.value, 10)
        : event.target.value
    setConfig({ ...config, [field]: value })
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Configuration saved successfully!
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            API Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="OpenAI API Key"
                type="password"
                value={config.openai_api_key}
                onChange={handleChange('openai_api_key')}
                helperText="Your OpenAI API key for LLM transformations"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="n8n Webhook URL"
                value={config.n8n_webhook_url}
                onChange={handleChange('n8n_webhook_url')}
                helperText="The n8n webhook endpoint for Jira integration"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="n8n API Key"
                type="password"
                value={config.n8n_api_key}
                onChange={handleChange('n8n_api_key')}
                helperText="Optional API key for authenticating with n8n"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" gutterBottom>
            Processor Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Host"
                value={config.processor_host}
                onChange={handleChange('processor_host')}
                helperText="The host address to bind the processor server"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Port"
                type="number"
                value={config.processor_port}
                onChange={handleChange('processor_port')}
                helperText="The port number for the processor server"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" gutterBottom>
            Processing Options
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.auto_retry}
                    onChange={handleChange('auto_retry')}
                  />
                }
                label="Enable automatic retry for failed messages"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Retries"
                type="number"
                value={config.max_retries}
                onChange={handleChange('max_retries')}
                disabled={!config.auto_retry}
                helperText="Maximum number of retry attempts"
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            About
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Teams Message Extractor v1.0.0
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This application automatically extracts and processes messages from Microsoft Teams
            channels, enriches them with AI-powered analysis, and creates Jira issues via n8n
            workflows.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
