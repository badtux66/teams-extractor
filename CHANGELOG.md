# Changelog

All notable changes to the Teams-to-Jira automation project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-21

### Added
- Comprehensive README with troubleshooting guide and security best practices
- API documentation with detailed endpoint descriptions and examples (docs/API.md)
- Deployment guide with Docker, Kubernetes, and cloud provider examples (docs/DEPLOYMENT.md)
- Docker support with Dockerfile and docker-compose.yml
- Correlation ID tracking for distributed tracing
- Structured logging with correlation IDs
- API key authentication support via PROCESSOR_API_KEY environment variable
- CORS configuration via ALLOWED_ORIGINS environment variable
- Test suite with pytest for processor and agent components
- Configuration examples (.env.example, config.example.json)
- .gitignore for better repository hygiene
- MCP package __init__.py with proper exports

### Changed
- CORS now defaults to localhost only instead of allowing all origins (security improvement)
- CORS configuration now restricts allowed methods and headers
- Improved error handling in processor with detailed logging
- Enhanced /ingest endpoint with proper error messages and validation

### Fixed
- Missing 'os' import in mcp/teams_agent.py that caused runtime error
- CORS security issue - no longer allows all origins by default
- Empty mcp/__init__.py now properly exports modules

### Security
- API key authentication now properly enforced when PROCESSOR_API_KEY is set
- CORS restricted to specific origins for production use
- Added security headers recommendations in nginx configuration
- Documented security best practices in README

## [1.0.0] - 2025-10-20

### Added
- Initial release
- Browser extension for capturing Teams messages
- FastAPI processor for message ingestion and LLM processing
- MCP agent for OpenAI integration
- n8n workflow template for Jira integration
- SQLite database for message persistence
- Basic documentation (README.md, docs/architecture.md)

### Features
- Automatic message classification (localized vs global)
- LLM-powered extraction of deployment information
- Retry logic in browser extension
- Health check endpoints
- Message status tracking
