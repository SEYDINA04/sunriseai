.PHONY: help install dev up down logs migrate migrate-auto shell lint fmt

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install Python dependencies
	pip install -r requirements.txt

dev: ## Run the app locally with hot-reload (requires Postgres + Redis running)
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

up: ## Start all services (Postgres, Redis, app) via Docker Compose
	docker-compose up --build -d

down: ## Stop and remove all containers
	docker-compose down

logs: ## Tail logs from all containers
	docker-compose logs -f

migrate: ## Apply pending Alembic migrations
	alembic upgrade head

migrate-auto: ## Auto-generate a new migration (usage: make migrate-auto msg="your message")
	alembic revision --autogenerate -m "$(msg)"

migrate-down: ## Roll back the last migration
	alembic downgrade -1

shell: ## Open a psql shell in the running Postgres container
	docker-compose exec postgres psql -U postgres -d bambi_ai

redis-cli: ## Open a redis-cli shell in the running Redis container
	docker-compose exec redis redis-cli

lint: ## Run ruff linter
	ruff check app/

fmt: ## Auto-format with ruff
	ruff format app/
