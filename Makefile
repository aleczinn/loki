PROJECT_NAME=loki

define CALL_CONTAINER
	docker-compose -f docker-compose.yml -p $(PROJECT_NAME)
endef

.PHONY: start
start: ## Start all containers (frontend, backend, database)
	$(CALL_CONTAINER) up --detach

.PHONY: start-not-detached
start-not-detached: ## Start all containers in non-detached mode (frontend, backend, database)
	$(CALL_CONTAINER) up

.PHONY: stop
stop: ## Stop all container
	$(CALL_CONTAINER) down

.PHONY: restart
restart: stop start ## Restart your projects container