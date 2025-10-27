.PHONY: help build up down restart logs shell clean backup restore health

# Default target
.DEFAULT_GOAL := help

# Variables
COMPOSE_FILE ?= docker-compose.yml
COMPOSE_DEV = docker-compose.dev.yml
COMPOSE_PROD = docker-compose.prod.yml

## help: Show this help message
help:
	@echo "Teams Message Extractor - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^## ' Makefile | sed 's/## /  /'

## build: Build all Docker images
build:
	@echo "🐳 Building Docker images..."
	docker-compose -f $(COMPOSE_FILE) build

## build-dev: Build development images
build-dev:
	@echo "🐳 Building development images..."
	docker-compose -f $(COMPOSE_DEV) build

## build-prod: Build production images
build-prod:
	@echo "🐳 Building production images..."
	docker-compose -f $(COMPOSE_PROD) build --no-cache

## up: Start all services
up:
	@echo "🚀 Starting services..."
	docker-compose -f $(COMPOSE_FILE) up -d
	@make health

## up-dev: Start development environment
up-dev:
	@echo "🚀 Starting development environment..."
	docker-compose -f $(COMPOSE_DEV) up -d

## up-prod: Start production environment
up-prod:
	@echo "🚀 Starting production environment..."
	docker-compose -f $(COMPOSE_PROD) up -d
	@make health

## down: Stop all services
down:
	@echo "🛑 Stopping services..."
	docker-compose -f $(COMPOSE_FILE) down

## down-dev: Stop development environment
down-dev:
	@echo "🛑 Stopping development environment..."
	docker-compose -f $(COMPOSE_DEV) down

## down-prod: Stop production environment
down-prod:
	@echo "🛑 Stopping production environment..."
	docker-compose -f $(COMPOSE_PROD) down

## restart: Restart all services
restart:
	@echo "🔄 Restarting services..."
	docker-compose -f $(COMPOSE_FILE) restart

## logs: View logs for all services
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f

## logs-backend: View backend logs
logs-backend:
	docker-compose -f $(COMPOSE_FILE) logs -f backend

## logs-frontend: View frontend logs
logs-frontend:
	docker-compose -f $(COMPOSE_FILE) logs -f frontend

## shell-backend: Open shell in backend container
shell-backend:
	docker-compose -f $(COMPOSE_FILE) exec backend /bin/bash

## shell-frontend: Open shell in frontend container
shell-frontend:
	docker-compose -f $(COMPOSE_FILE) exec frontend /bin/sh

## ps: List running containers
ps:
	docker-compose -f $(COMPOSE_FILE) ps

## health: Run health checks
health:
	@echo "🔍 Running health checks..."
	@bash scripts/health-check-all.sh

## clean: Remove all containers, volumes, and images
clean:
	@echo "🧹 Cleaning up Docker resources..."
	docker-compose -f $(COMPOSE_FILE) down -v --rmi all
	@echo "✅ Cleanup complete"

## clean-all: Deep clean including build cache
clean-all: clean
	@echo "🧹 Deep cleaning..."
	docker system prune -af --volumes
	@echo "✅ Deep clean complete"

## backup: Create backup of data and configuration
backup:
	@echo "📦 Creating backup..."
	@bash scripts/backup.sh

## restore: Restore from backup
restore:
	@echo "📦 Restoring from backup..."
	@bash scripts/restore.sh

## start: Full startup with health checks (recommended)
start:
	@bash scripts/start.sh

## start-dev: Start development environment with hot reload
start-dev:
	@bash scripts/start.sh dev

## start-prod: Start production environment
start-prod:
	@bash scripts/start.sh prod

## stop: Full shutdown
stop:
	@bash scripts/stop.sh

## rebuild: Rebuild and restart all services
rebuild:
	@echo "🔨 Rebuilding services..."
	docker-compose -f $(COMPOSE_FILE) down
	docker-compose -f $(COMPOSE_FILE) build --no-cache
	docker-compose -f $(COMPOSE_FILE) up -d
	@make health

## stats: Show container resource usage
stats:
	docker stats --no-stream

## prune: Remove unused Docker resources
prune:
	@echo "🧹 Pruning unused Docker resources..."
	docker system prune -f
	@echo "✅ Prune complete"

## install: Initial setup (create .env, build, start)
install:
	@echo "📦 Installing Teams Message Extractor..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env from template"; \
		echo "⚠️  Please edit .env and add your API keys!"; \
	fi
	@make build
	@make up
	@echo ""
	@echo "========================================="
	@echo "✅ Installation Complete!"
	@echo "========================================="
	@echo ""
	@echo "Access the application:"
	@echo "  - Web GUI: http://localhost:3000"
	@echo "  - API: http://localhost:8090"
	@echo "  - API Docs: http://localhost:8090/docs"
	@echo ""

## update: Pull latest changes and restart
update:
	@echo "🔄 Updating application..."
	git pull
	@make rebuild
	@echo "✅ Update complete"

## test: Run tests (placeholder)
test:
	@echo "🧪 Running tests..."
	@echo "⚠️  Test suite not yet implemented"

## db-shell: Open SQLite shell for database
db-shell:
	@echo "🗄️  Opening database shell..."
	sqlite3 data/teams_messages.db

## db-backup: Backup database only
db-backup:
	@echo "💾 Backing up database..."
	@mkdir -p backups
	@cp data/teams_messages.db backups/teams_messages_$(shell date +%Y%m%d_%H%M%S).db
	@echo "✅ Database backed up"

## db-stats: Show database statistics
db-stats:
	@echo "📊 Database Statistics:"
	@echo ""
	@sqlite3 data/teams_messages.db "SELECT COUNT(*) as total_messages FROM messages;" | awk '{print "Total Messages: " $$1}'
	@sqlite3 data/teams_messages.db "SELECT status, COUNT(*) as count FROM messages GROUP BY status;" | column -t -s '|'

## version: Show version information
version:
	@echo "Teams Message Extractor"
	@echo "Version: 1.0.0"
	@echo ""
	@echo "Docker: $(shell docker --version)"
	@echo "Docker Compose: $(shell docker-compose --version)"
