.PHONY: start stop clean

#   FRONTEND_PORT=9091 BACKEND_PORT=5002
start:
	docker-compose up -d --build
	@echo "Frontend: http://localhost:$(or $(FRONTEND_PORT),9090)   Backend: http://localhost:$(or $(BACKEND_PORT),5001)"

stop:
	docker-compose down

clean:
	docker-compose down --rmi all --volumes --remove-orphans
	docker builder prune -f
