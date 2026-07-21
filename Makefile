# DocuCheck — Makefile (main branch)
# Local dev runs the app directly with Node; Docker targets run the containerized stack.
# Production deploys from the `prod` branch (Cloudflare Pages + Render); `prod` has no Docker.

.PHONY: setup start build clean up down docker-build docker-logs

## --- Local development (no containers) ---

# Install backend and frontend dependencies
setup:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Run backend (http://localhost:5000) and frontend (http://localhost:5173) dev servers
start:
	@echo "Starting backend and frontend dev servers in new terminals..."
	start cmd /c "cd backend && npm run dev"
	start cmd /c "cd frontend && npm run dev"

# Build the frontend for production
build:
	cd frontend && npm run build

# Remove installed dependencies and build output
clean:
	@echo "Removing node_modules and build output..."
	rm -rf backend/node_modules frontend/node_modules frontend/dist

## --- Docker (containerized stack) ---

# Build and start all services in the background
up:
	docker-compose up -d --build
	@echo "Frontend: http://localhost:8080   Backend: http://localhost:5000"

# Stop all services
down:
	docker-compose down

# Build Docker images
docker-build:
	docker-compose build

# Follow container logs
docker-logs:
	docker-compose logs -f
