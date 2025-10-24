# Teams Message Extractor - Troubleshooting Guide

Common issues and their solutions.

## Authentication Issues

### Error: "AADSTS700016: Application not found"

**Cause**: Application ID is incorrect or app not registered.

**Solution**:
1. Verify the `client_id` in your config
2. Check Azure AD App Registrations
3. Ensure you're using the correct tenant

### Error: "AADSTS7000215: Invalid client secret"

**Cause**: Client secret is incorrect or expired.

**Solution**:
1. Generate a new client secret in Azure AD
2. Update `client_secret` in your config
3. Ensure there are no extra spaces or characters

### Error: "Insufficient privileges to complete the operation"

**Cause**: Missing required API permissions or admin consent not granted.

**Solution**:
1. Go to Azure AD → App registrations → Your app → API permissions
2. Verify all required permissions are added:
   - `ChannelMessage.Read.All`
   - `Channel.ReadBasic.All`
   - `Team.ReadBasic.All`
   - `User.Read.All` (for service principal)
3. Click "Grant admin consent"
4. Wait 5-10 minutes for changes to propagate

## Rate Limiting Issues

### Error: "Rate limited (429)"

**Cause**: Too many requests to Microsoft Graph API.

**Solution**:
1. The tool automatically retries with backoff
2. Reduce `batch_size` in extraction config
3. Increase `rate_limit_pause`:
   ```python
   graph_client = GraphAPIClient(..., rate_limit_pause=1.0)  # 1 second pause
   ```
4. Extract from fewer channels simultaneously

### Error: "Throttling error"

**Solution**:
- Wait a few minutes before retrying
- Spread extractions throughout the day
- Use scheduled jobs instead of large manual extractions

## Data Extraction Issues

### No Messages Found

**Cause**: Filters too restrictive or no messages in time range.

**Solution**:
1. Remove filters and try again:
   ```bash
   python -m src.cli.main extract --last-hours 24 --format json
   ```
2. Verify you have access to the channels
3. Check date ranges are correct
4. Test with a specific channel you know has messages

### Missing Channels

**Cause**: No access to private channels or teams.

**Solution**:
1. Verify user/app has access to the teams
2. For private channels, app needs explicit permission
3. Check team membership
4. Use delegated auth to use your personal permissions

### Incomplete Threads

**Cause**: Permissions or deleted messages.

**Solution**:
1. Ensure `include_replies: true` in config
2. Check if messages were deleted
3. Verify `ChannelMessage.Read.All` permission

## Integration Issues

### Jira: "Could not create issue"

**Cause**: Invalid Jira configuration or permissions.

**Solution**:
1. Verify Jira URL is correct (no trailing slash)
2. Check API token is valid
3. Verify you have permission to create issues in the project
4. Test with:
   ```bash
   curl -u user@company.com:API_TOKEN \
     https://yourcompany.atlassian.net/rest/api/3/myself
   ```

### Confluence: "Space not found"

**Cause**: Invalid space key or no access.

**Solution**:
1. Verify space key is correct (case-sensitive)
2. Check you have edit permissions in the space
3. Test access via Confluence web interface

### Email: "SMTP authentication failed"

**Cause**: Invalid credentials or 2FA required.

**Solution**:
1. For Gmail: Use App Password, not account password
2. For Office 365: Enable "Allow less secure apps"
3. Verify SMTP host and port:
   - Gmail: smtp.gmail.com:587
   - Office365: smtp.office365.com:587
4. Check `use_tls` setting matches your server

## Performance Issues

### Extraction Taking Too Long

**Solution**:
1. Use filters to reduce message count:
   ```bash
   --keywords "incident" --channel "Ops"
   ```
2. Set `max_messages` limit:
   ```bash
   --max-messages 1000
   ```
3. Increase `batch_size` (but watch for rate limits):
   ```yaml
   extraction_config:
     batch_size: 100
   ```

### High Memory Usage

**Cause**: Large number of messages loaded in memory.

**Solution**:
1. Process in smaller batches
2. Extract one channel at a time
3. Use filters to reduce message count
4. Limit time ranges

## Export Issues

### HTML Export Shows Garbled Text

**Cause**: Encoding issues with special characters.

**Solution**:
- Exports use UTF-8 encoding by default
- Ensure your viewer supports UTF-8
- Try opening with a different browser

### CSV Missing Data

**Cause**: Commas in message content or export fields not configured.

**Solution**:
1. CSV exporter properly escapes commas
2. Check if specific fields are needed:
   ```python
   CSVExporter.export(result, path, fields=["message_id", "author", "body_content"])
   ```

## Scheduled Jobs Issues

### Jobs Not Running

**Cause**: Scheduler not started or job disabled.

**Solution**:
1. Verify job has `enabled: true`
2. Check scheduler is running:
   ```bash
   python -m src.cli.main schedule --job-config config/jobs.yaml
   ```
3. Review cron expression is valid
4. Check logs for errors

### Job Failures Not Notified

**Cause**: Email not configured or error callback not set.

**Solution**:
1. Enable email notifications in config
2. Check email settings are correct
3. Add error logging:
   ```yaml
   log_file: "logs/scheduler.log"
   log_level: "DEBUG"
   ```

## Connection Issues

### Error: "Connection timeout"

**Cause**: Network issues or firewall blocking.

**Solution**:
1. Check internet connection
2. Verify firewall allows HTTPS (port 443)
3. Test connection:
   ```bash
   curl https://graph.microsoft.com/v1.0/
   ```
4. Check proxy settings if behind corporate proxy

### Error: "SSL Certificate verify failed"

**Cause**: SSL certificate issues.

**Solution**:
1. Update CA certificates:
   ```bash
   pip install --upgrade certifi
   ```
2. Check system time is correct
3. If using corporate proxy, may need to install corporate CA cert

## Debugging

### Enable Debug Logging

```bash
python -m src.cli.main --log-level DEBUG extract --last-hours 1 --format json
```

### Check API Requests

Add verbose logging to see all API calls:
```yaml
log_level: "DEBUG"
```

### Test Individual Components

Test Graph API:
```bash
python -m src.cli.main test-connection
```

Test with minimal extraction:
```bash
python -m src.cli.main extract --last-hours 1 --max-messages 10 --format json
```

## Common Error Messages

### "No module named 'src'"

**Cause**: Running from wrong directory.

**Solution**:
```bash
cd /path/to/teams-extractor
python -m src.cli.main --help
```

### "Config file not found"

**Cause**: Config file missing or wrong path.

**Solution**:
```bash
cp config/config.yaml.example config/config.yaml
# Edit config.yaml with your credentials
```

### "ValueError: Configuration errors"

**Cause**: Missing required configuration fields.

**Solution**:
1. Check config.yaml has all required fields:
   - `tenant_id`
   - `client_id`
   - `client_secret` (if not using delegated auth)
2. Verify no empty required fields

## Getting Help

### Check Logs

```bash
# View recent logs
tail -f logs/teams-extractor.log

# Search for errors
grep -i error logs/teams-extractor.log
```

### Verbose Output

Run with debug logging:
```bash
python -m src.cli.main --log-level DEBUG --log-file debug.log extract --last-hours 1
```

### Validate Configuration

```python
from config.settings import Settings

settings = Settings.load_from_file("config/config.yaml")
settings.validate()
print("Configuration valid!")
```

## Microsoft Graph API Limits

### Rate Limits

- **Per app per tenant**: 2000 requests per second
- **Per user**: 1000 requests per second

### Throttling Responses

The tool handles throttling automatically with exponential backoff:
1. Wait for `Retry-After` header duration
2. Exponential backoff: 2s, 4s, 8s, 16s
3. Maximum 4 retries

### Best Practices

1. Use filters to reduce API calls
2. Batch requests when possible
3. Cache team/channel data
4. Schedule large extractions during off-peak hours

## Performance Optimization

### Speed Up Extractions

1. **Use specific filters**:
   ```bash
   --channel "Specific-Channel" --keywords "keyword"
   ```

2. **Increase batch size** (if not hitting rate limits):
   ```yaml
   batch_size: 100
   ```

3. **Use service principal auth** (faster than delegated):
   ```yaml
   use_delegated_auth: false
   ```

### Reduce Memory Usage

1. Process fewer messages at once
2. Use streaming for large exports
3. Clear old output files regularly

## Still Having Issues?

1. Check the [GitHub Issues](https://github.com/yourrepo/teams-extractor/issues)
2. Review Microsoft Graph API documentation
3. Verify Azure AD app configuration
4. Check Microsoft 365 service health status
