# DocuCheck — Makefile (main branch)
# Runs the containerized stack via Docker Compose.
#   make start  → build and start the app
#   make stop   → stop the app
#   make clean  → remove this project's containers, images, and build cache

.PHONY: start stop clean

# Build images and start all services in the background.
# Override host ports if they conflict, e.g. on macOS:
#   FRONTEND_PORT=9090 BACKEND_PORT=5002 make start
start:
	docker-compose up -d --build
	@echo "Frontend: http://localhost:$(or $(FRONTEND_PORT),8080)   Backend: http://localhost:$(or $(BACKEND_PORT),5001)"

# Stop and remove the running containers.
stop:
	docker-compose down

# Remove this project's containers, images, volumes, orphans, and build cache.
clean:
	docker-compose down --rmi all --volumes --remove-orphans
	docker builder prune -f
