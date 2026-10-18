SHELL := /bin/sh

GO := go
GOFMT := gofmt
PYTHON := python3
NPM := npm
RUFF := ruff
GOLANGCI_LINT := golangci-lint
DOCKER := docker
HELM := helm

GO_MODULES := \
	backend/services/api-gateway \
	backend/services/discovery \
	backend/services/monitoring \
	backend/services/remediation \
	backend/services/notification \
	backend/services/documentation \
	backend/shared/pkg/events \
	backend/shared/pkg/db \
	cli

PYTHON_DIR := backend/services/ai-engine
FRONTEND_DIR := frontend/web
HELM_CHART := helm-charts/tagent

DOCKER_SERVICES := api-gateway discovery monitoring ai-engine remediation notification web
DOCKER_REGISTRY ?= yaswanth111
IMAGE_PREFIX ?= $(DOCKER_REGISTRY)/tagent
IMAGE_TAG ?= latest

.PHONY: help build test test-go test-python test-frontend lint lint-go lint-python lint-frontend fmt run docker-build docker-push helm-lint clean

help:
	@echo "Tagent development targets:"
	@echo "  make build         Build all Go modules"
	@echo "  make test          Run Go, Python, and frontend tests"
	@echo "  make lint          Run golangci-lint, Ruff, and ESLint"
	@echo "  make fmt           Format Go, Python, and frontend sources"
	@echo "  make run           Start local infrastructure and the API Gateway"
	@echo "  make docker-build  Build service images"
	@echo "  make docker-push   Build and push service images"
	@echo "  make helm-lint     Lint and render the Helm chart"
	@echo "  make clean         Remove generated build and test artifacts"

build:
	@set -e; for dir in $(GO_MODULES); do \
		echo "Building $$dir"; \
		(cd "$$dir" && $(GO) build ./...); \
	done

test: test-go test-python test-frontend

test-go:
	@set -e; for dir in $(GO_MODULES); do \
		echo "Testing $$dir"; \
		(cd "$$dir" && $(GO) test ./... -short); \
	done

test-python:
	@cd $(PYTHON_DIR) && $(PYTHON) -m pytest --tb=short -q

test-frontend:
	@cd $(FRONTEND_DIR) && $(NPM) run test

lint: lint-go lint-python lint-frontend

lint-go:
	@set -e; for dir in $(GO_MODULES); do \
		echo "Linting $$dir"; \
		(cd "$$dir" && $(GOLANGCI_LINT) run ./...); \
	done

lint-python:
	@cd $(PYTHON_DIR) && $(RUFF) check .

lint-frontend:
	@cd $(FRONTEND_DIR) && $(NPM) run lint

fmt:
	@set -e; for dir in $(GO_MODULES); do \
		find "$$dir" -type f -name '*.go' -not -path '*/vendor/*' -print0 | xargs -0 -r $(GOFMT) -w; \
	done
	@cd $(PYTHON_DIR) && $(RUFF) format .
	@cd $(FRONTEND_DIR) && npx --yes prettier@3 --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"

run:
	@$(DOCKER) compose -f docker-compose.dev.yml up -d
	@cd backend/services/api-gateway && $(GO) run cmd/server/main.go

docker-build:
	@set -e; for service in $(DOCKER_SERVICES); do \
		echo "Building $(IMAGE_PREFIX)-$$service:$(IMAGE_TAG)"; \
		$(DOCKER) build -f deployment/docker/$$service.Dockerfile -t $(IMAGE_PREFIX)-$$service:$(IMAGE_TAG) .; \
	done

docker-push: docker-build
	@set -e; for service in $(DOCKER_SERVICES); do \
		$(DOCKER) push $(IMAGE_PREFIX)-$$service:$(IMAGE_TAG); \
	done

helm-lint:
	@$(HELM) lint $(HELM_CHART)
	@$(HELM) template tagent $(HELM_CHART) >/dev/null

clean:
	@rm -rf bin $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out
	@find . -type d -name __pycache__ -prune -exec rm -rf {} +
	@$(GO) clean -cache -testcache
