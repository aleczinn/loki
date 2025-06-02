PROJECT_NAME=loki

define CALL_CONTAINER
	docker-compose -f docker-compose.yml -p $(PROJECT_NAME)
endef

.PHONY: build
build: ## Build all containers
	$(CALL_CONTAINER) build

.PHONY: start
start: ## Start all containers
	$(CALL_CONTAINER) up --detach

.PHONY: start-not-detached
start-not-detached: ## Start all containers in non-detached mode
	$(CALL_CONTAINER) up

.PHONY: start-frontend
start-frontend: ## Start the frontend container
	$(CALL_CONTAINER) up --detach frontend

.PHONY: stop
stop: ## Stop all container
	$(CALL_CONTAINER) down

.PHONY: deploy
deploy: build start  ## Build and start all containers

.PHONY: restart
restart: stop build start ## Restart your projects container

.PHONY: logs-frontend
logs-frontend: ## Show logs for frontend
	$(CALL_CONTAINER) logs -f frontend

.PHONY: logs-backend
logs-backend: ## Show logs for frontend
	$(CALL_CONTAINER) logs -f backend

.PHONY: clean
clean: ## Show logs for frontend
	$(CALL_CONTAINER) down -v
	docker system prune -f