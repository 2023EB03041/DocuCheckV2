.PHONY: setup start start-bg stop logs docker-up docker-down docker-build docker-logs clean

## Docker Commands
.PHONY: up down

# Start the entire project using Docker Compose
up:
	docker-compose up -d --build

# Stop the entire project using Docker Compose
down:
	docker-compose down

# Local Node commands (Without Docker)
setup:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

start:
	@echo "Starting backend and frontend locally (interactive)..."
	@echo "Opening new terminal windows for Backend and Frontend."
	start cmd /c "cd backend && npm run dev"
	start cmd /c "cd frontend && npm run dev"

# Docker commands
docker-build:
	@echo "Building Docker images..."
	docker-compose build

docker-up:
	@echo "Starting project in Docker containers..."
	docker-compose up -d
	@echo "=========================================================="
	@echo "🚀 Services started successfully in the background!"
	@echo "🌍 Frontend running at: http://localhost:5173"
	@echo "⚙️  Backend running at:  http://localhost:5000"
	@echo "=========================================================="

docker-down:
	@echo "Stopping Docker containers..."
	docker-compose down

docker-logs:
	docker-compose logs -f

# Clean up
clean:
	@echo "Removing node_modules..."
	rm -rf backend/node_modules frontend/node_modules
	@echo "Removing temporary uploads..."
	rm -rf backend/uploads/*
