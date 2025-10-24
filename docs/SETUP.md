# Teams Message Extractor - Setup Guide

This guide will walk you through setting up the Teams Message Extractor tool.

## Prerequisites

- Python 3.10 or higher
- Microsoft Azure AD Application Registration
- Access to Microsoft Teams (with appropriate permissions)
- (Optional) Jira Cloud/Server instance
- (Optional) Confluence Cloud/Server instance

## 1. Azure AD Application Registration

### For Service Principal (Recommended for Automation)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Configure the application:
   - **Name**: Teams Message Extractor
   - **Supported account types**: Single tenant
   - **Redirect URI**: Leave empty
4. Click **Register**

5. **Note down**:
   - Application (client) ID
   - Directory (tenant) ID

6. Create a client secret:
   - Go to **Certificates & secrets** → **New client secret**
   - Add description and expiry
   - **Copy the secret value** (you won't be able to see it again!)

7. Configure API permissions:
   - Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**
   - Add these permissions:
     - `ChannelMessage.Read.All` - Read all channel messages
     - `Channel.ReadBasic.All` - Read basic channel information
     - `Team.ReadBasic.All` - Read basic team information
     - `User.Read.All` - Read user profiles
   - Click **Grant admin consent**

### For Delegated Authentication (User-based)

1. Follow steps 1-4 above
2. Configure API permissions:
   - Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Add these permissions:
     - `ChannelMessage.Read.All`
     - `Channel.ReadBasic.All`
     - `Team.ReadBasic.All`
     - `User.Read`
   - Grant admin consent
3. Set redirect URI:
   - Go to **Authentication** → **Add a platform** → **Mobile and desktop applications**
   - Check `https://login.microsoftonline.com/common/oauth2/nativeclient`

## 2. Installation

### Clone the Repository

```bash
git clone <repository-url>
cd teams-extractor
```

### Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

## 3. Configuration

### Create Configuration File

```bash
cp config/config.yaml.example config/config.yaml
```

### Edit Configuration

Edit `config/config.yaml` with your credentials:

```yaml
graph_api:
  tenant_id: "your-tenant-id"
  client_id: "your-client-id"
  client_secret: "your-client-secret"  # Only for service principal
  use_delegated_auth: false  # Set to true for user-based auth

# Optional integrations
jira:
  enabled: false  # Set to true if using Jira
  url: "https://yourcompany.atlassian.net"
  username: "your-email@company.com"
  api_token: "your-api-token"
  default_project: "PROJ"

confluence:
  enabled: false  # Set to true if using Confluence
  url: "https://yourcompany.atlassian.net/wiki"
  username: "your-email@company.com"
  api_token: "your-api-token"
  default_space: "TEAM"

email:
  enabled: false  # Set to true if using email notifications
  smtp_host: "smtp.gmail.com"
  smtp_port: 587
  username: "your-email@gmail.com"
  password: "your-app-password"
  from_address: "your-email@gmail.com"

output_dir: "output"
log_level: "INFO"
```

### Using Environment Variables (Alternative)

Instead of a config file, you can use environment variables:

```bash
export TEAMS_TENANT_ID="your-tenant-id"
export TEAMS_CLIENT_ID="your-client-id"
export TEAMS_CLIENT_SECRET="your-client-secret"
export TEAMS_USE_DELEGATED_AUTH="false"

# Optional
export JIRA_ENABLED="true"
export JIRA_URL="https://yourcompany.atlassian.net"
export JIRA_USERNAME="your-email@company.com"
export JIRA_API_TOKEN="your-api-token"
export JIRA_DEFAULT_PROJECT="PROJ"
```

## 4. Getting Jira API Token (Optional)

1. Log in to Atlassian
2. Go to [API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
3. Click **Create API token**
4. Give it a label and copy the token

## 5. Getting Confluence API Token (Optional)

Same as Jira - Atlassian uses the same API token for both services.

## 6. Email Configuration (Optional)

### Gmail

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the generated password
3. Use this app password in the configuration

### Other SMTP Providers

- **Office 365**: smtp.office365.com:587
- **Outlook**: smtp-mail.outlook.com:587
- **Yahoo**: smtp.mail.yahoo.com:587

## 7. Test Installation

Test your Graph API connection:

```bash
python -m src.cli.main test-connection
```

If successful, you should see:
```
✓ Successfully connected to Microsoft Graph API
✓ Found X teams
```

## 8. Directory Structure

```
teams-extractor/
├── config/
│   ├── config.yaml           # Your configuration (create from example)
│   ├── config.yaml.example   # Example configuration
│   └── jobs.yaml.example     # Example scheduled jobs
├── src/
│   ├── core/                 # Core extraction engine
│   ├── exporters/            # Export formats
│   ├── integrations/         # Jira, Confluence, Email
│   ├── scheduler/            # Scheduled jobs
│   └── cli/                  # Command-line interface
├── output/                   # Extraction output (created automatically)
├── logs/                     # Log files (created automatically)
├── requirements.txt          # Python dependencies
└── docs/                     # Documentation
```

## 9. Troubleshooting

### Permission Errors

If you get permission errors:
1. Verify admin consent was granted in Azure AD
2. Check that all required permissions are added
3. Wait a few minutes for permissions to propagate

### Authentication Errors

- **Service Principal**: Verify client secret is correct and not expired
- **Delegated Auth**: Ensure redirect URI is configured correctly

### Rate Limiting

If you hit rate limits:
1. Increase `rate_limit_pause` in extraction config
2. Reduce `batch_size`
3. Add delays between requests

## Next Steps

- See [USAGE.md](./USAGE.md) for usage examples
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Check out example configurations in `config/`
