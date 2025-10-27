# ============================================
# Teams Extractor - MCP Server Dockerfile
# ============================================

FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1000 mcpgroup && \
    adduser -D -u 1000 -G mcpgroup mcpuser

WORKDIR /app

# Copy package files
COPY --chown=mcpuser:mcpgroup package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=mcpuser:mcpgroup index.js ./

# Switch to non-root user
USER mcpuser

# Health check (note: MCP server uses stdio, so this is minimal)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "console.log('healthy')"

# Start MCP server
CMD ["node", "index.js"]
