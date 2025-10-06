#!/bin/bash

# Waitlist Management System Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
REGISTRY=${DOCKER_REGISTRY:-"your-registry.com"}
IMAGE_NAME="waitlist-management"

echo -e "${GREEN}Starting deployment for environment: ${ENVIRONMENT}${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

# Check required environment variables
check_env_vars() {
    local required_vars=(
        "JWT_SECRET"
        "SENDGRID_API_KEY"
        "SENDGRID_FROM_EMAIL"
        "DATABASE_URL"
        "REDIS_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo -e "${RED}Error: Required environment variable $var is not set${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✓ All required environment variables are set${NC}"
}

# Build and tag Docker image
build_image() {
    echo -e "${YELLOW}Building Docker image...${NC}"
    
    docker build -t ${IMAGE_NAME}:${VERSION} .
    docker tag ${IMAGE_NAME}:${VERSION} ${REGISTRY}/${IMAGE_NAME}:${VERSION}
    docker tag ${IMAGE_NAME}:${VERSION} ${REGISTRY}/${IMAGE_NAME}:latest
    
    echo -e "${GREEN}✓ Docker image built successfully${NC}"
}

# Push image to registry
push_image() {
    echo -e "${YELLOW}Pushing image to registry...${NC}"
    
    docker push ${REGISTRY}/${IMAGE_NAME}:${VERSION}
    docker push ${REGISTRY}/${IMAGE_NAME}:latest
    
    echo -e "${GREEN}✓ Image pushed to registry${NC}"
}

# Run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    # Create a temporary container to run migrations
    docker run --rm \
        -e DATABASE_URL="${DATABASE_URL}" \
        ${REGISTRY}/${IMAGE_NAME}:${VERSION} \
        npm run migrate
    
    echo -e "${GREEN}✓ Database migrations completed${NC}"
}

# Deploy to environment
deploy() {
    echo -e "${YELLOW}Deploying to ${ENVIRONMENT}...${NC}"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        deploy_production
    else
        deploy_staging
    fi
}

# Production deployment
deploy_production() {
    # Blue-green deployment strategy
    echo -e "${YELLOW}Performing blue-green deployment...${NC}"
    
    # Update docker-compose with new image
    export IMAGE_TAG=${VERSION}
    
    # Deploy new version alongside current
    docker-compose -f docker-compose.prod.yml up -d --scale app=2
    
    # Health check new instances
    echo -e "${YELLOW}Performing health checks...${NC}"
    sleep 30
    
    # Check if new instances are healthy
    if ! curl -f http://localhost:3000/health; then
        echo -e "${RED}Health check failed, rolling back...${NC}"
        docker-compose -f docker-compose.prod.yml down
        exit 1
    fi
    
    # Remove old instances
    docker-compose -f docker-compose.prod.yml up -d --scale app=1
    
    echo -e "${GREEN}✓ Production deployment completed${NC}"
}

# Staging deployment
deploy_staging() {
    echo -e "${YELLOW}Deploying to staging...${NC}"
    
    export IMAGE_TAG=${VERSION}
    docker-compose -f docker-compose.staging.yml down
    docker-compose -f docker-compose.staging.yml up -d
    
    # Wait for services to start
    sleep 20
    
    # Health check
    if ! curl -f http://staging.yourdomain.com/health; then
        echo -e "${RED}Staging deployment health check failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Staging deployment completed${NC}"
}

# Rollback function
rollback() {
    local previous_version=${1:-"previous"}
    echo -e "${YELLOW}Rolling back to version: ${previous_version}${NC}"
    
    export IMAGE_TAG=${previous_version}
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker-compose -f docker-compose.prod.yml up -d
    else
        docker-compose -f docker-compose.staging.yml up -d
    fi
    
    echo -e "${GREEN}✓ Rollback completed${NC}"
}

# Cleanup old images
cleanup() {
    echo -e "${YELLOW}Cleaning up old Docker images...${NC}"
    
    # Remove images older than 7 days
    docker image prune -a --filter "until=168h" -f
    
    echo -e "${GREEN}✓ Cleanup completed${NC}"
}

# Main deployment flow
main() {
    case "${1:-deploy}" in
        "deploy")
            check_env_vars
            build_image
            push_image
            run_migrations
            deploy
            cleanup
            ;;
        "rollback")
            rollback $2
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            echo "Usage: $0 [deploy|rollback|cleanup] [environment] [version]"
            echo "  deploy:   Deploy application (default)"
            echo "  rollback: Rollback to previous version"
            echo "  cleanup:  Clean up old Docker images"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"