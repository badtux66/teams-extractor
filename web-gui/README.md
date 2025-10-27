# Teams Message Extractor - Web GUI

Modern React-based web interface for the Teams Message Extractor.

## Features

- 📊 Real-time dashboard with statistics
- 💬 Message viewer with search and filters
- 📈 Analytics with interactive charts
- ⚙️ Configuration management
- 🎨 Material-UI design
- 📱 Fully responsive
- 🌙 Dark/Light theme support (coming soon)

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Material-UI** - Component library
- **Recharts** - Data visualization
- **Zustand** - State management
- **Vite** - Build tool
- **Axios** - HTTP client

## Project Structure

```
web-gui/
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   └── Layout.tsx  # Main layout with sidebar
│   │   ├── pages/          # Page components
│   │   │   ├── Dashboard.tsx   # Dashboard page
│   │   │   ├── Messages.tsx    # Messages list
│   │   │   ├── Analytics.tsx   # Analytics page
│   │   │   └── Settings.tsx    # Settings page
│   │   ├── services/       # API services
│   │   │   └── api.ts      # API client
│   │   ├── store/          # State management
│   │   │   └── useStore.ts # Zustand store
│   │   ├── types/          # TypeScript types
│   │   │   └── index.ts    # Type definitions
│   │   ├── utils/          # Utility functions
│   │   ├── App.tsx         # Main app component
│   │   ├── main.tsx        # Entry point
│   │   └── theme.ts        # MUI theme config
│   ├── public/             # Static assets
│   ├── index.html          # HTML template
│   ├── package.json        # Dependencies
│   ├── tsconfig.json       # TypeScript config
│   └── vite.config.ts      # Vite config
└── nginx.conf              # Nginx config for production
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend running on http://localhost:8090

### Setup

```bash
# Install dependencies
cd web-gui/frontend
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload

# Building
npm run build        # Build for production
npm run preview      # Preview production build

# Linting
npm run lint         # Run ESLint
```

## API Integration

The frontend communicates with the backend API through a proxy configured in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8090',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

All API calls go through `/api/*` which are proxied to the backend.

## State Management

Uses Zustand for simple and efficient state management:

```typescript
import { useStore } from './store/useStore'

function MyComponent() {
  const { messages, setMessages } = useStore()
  // ...
}
```

## Routing

React Router v6 for client-side routing:

- `/dashboard` - Dashboard with statistics
- `/messages` - Message list and details
- `/analytics` - Charts and analytics
- `/settings` - Configuration

## Styling

Material-UI for consistent design:

- Pre-built components
- Customizable theme
- Responsive grid system
- Dark mode support (coming soon)

## API Client

Axios-based API client in `services/api.ts`:

```typescript
import { messagesApi, healthApi, configApi } from './services/api'

// Get messages
const messages = await messagesApi.getMessages()

// Get stats
const stats = await messagesApi.getStats()

// Health check
const health = await healthApi.getHealth()
```

## Building for Production

```bash
# Build optimized bundle
npm run build

# Output in dist/
ls dist/

# Test production build
npm run preview
```

Production build is optimized with:
- Code splitting
- Tree shaking
- Minification
- Asset optimization

## Docker Deployment

The frontend is deployed using multi-stage Docker build:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

Build and run:
```bash
docker build -f Dockerfile.frontend -t teams-extractor-frontend .
docker run -p 3000:80 teams-extractor-frontend
```

## Environment Variables

Can be configured in `.env` (optional):

```bash
VITE_API_URL=http://localhost:8090
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## Performance

Optimizations:
- Lazy loading of routes
- Memoization of expensive components
- Debounced search inputs
- Efficient re-renders with Zustand
- Production build optimizations

## Browser Support

Supports all modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

Following WCAG 2.1 guidelines:
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support

## Troubleshooting

### Port 3000 already in use

```bash
# Change port in vite.config.ts
server: {
  port: 3001
}
```

### Cannot connect to backend

Check that:
1. Backend is running on port 8090
2. Proxy is configured correctly
3. CORS is enabled on backend

### Build fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Future Enhancements

- [ ] WebSocket for real-time updates
- [ ] Dark mode implementation
- [ ] Export data (CSV, Excel, JSON)
- [ ] Advanced filtering options
- [ ] User authentication
- [ ] Role-based access control
- [ ] Mobile app (React Native)
- [ ] Progressive Web App (PWA)
- [ ] Internationalization (i18n)
- [ ] Custom dashboard widgets

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

[Add your license here]

## Support

- [User Manual](../docs/USER_MANUAL.md)
- [API Documentation](../docs/API_REFERENCE.md)
- [Troubleshooting](../docs/TROUBLESHOOTING.md)

---

**Version**: 1.0.0
**Last Updated**: 2025-10-27
