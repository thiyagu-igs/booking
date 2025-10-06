# Waitlist Management System Deployment Script for Windows
param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "rollback", "cleanup")]
    [string]$Action = "deploy",
    
    [Parameter(Position=1)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "production",
    
    [Parameter(Position=2)]
    [string]$Version = "latest"
)

# Configuration
$Registry = $env:DOCKER_REGISTRY ?? "your-registry.com"
$ImageName = "waitlist-management"

Write-Host "Starting deployment for environment: $Environment" -ForegroundColor Green

# Check required environment variables
function Test-EnvironmentVariables {
    $requiredVars = @(
        "JWT_SECRET",
        "SENDGRID_API_KEY", 
        "SENDGRID_FROM_EMAIL",
        "DATABASE_URL",
        "REDIS_URL"
    )
    
    foreach ($var in $requiredVars) {
        if (-not (Get-Variable -Name $var -ErrorAction SilentlyContinue)) {
            Write-Host "Error: Required environment variable $var is not set" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "✓ All required environment variables are set" -ForegroundColor Green
}

# Build and tag Docker image
function Build-Image {
    Write-Host "Building Docker image..." -ForegroundColor Yellow
    
    docker build -t "${ImageName}:${Version}" .
    docker tag "${ImageName}:${Version}" "${Registry}/${ImageName}:${Version}"
    docker tag "${ImageName}:${Version}" "${Registry}/${ImageName}:latest"
    
    Write-Host "✓ Docker image built successfully" -ForegroundColor Green
}

# Push image to registry
function Push-Image {
    Write-Host "Pushing image to registry..." -ForegroundColor Yellow
    
    docker push "${Registry}/${ImageName}:${Version}"
    docker push "${Registry}/${ImageName}:latest"
    
    Write-Host "✓ Image pushed to registry" -ForegroundColor Green
}

# Run database migrations
function Invoke-Migrations {
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    
    docker run --rm -e DATABASE_URL="$env:DATABASE_URL" "${Registry}/${ImageName}:${Version}" npm run migrate
    
    Write-Host "✓ Database migrations completed" -ForegroundColor Green
}

# Deploy to environment
function Deploy-Application {
    Write-Host "Deploying to $Environment..." -ForegroundColor Yellow
    
    if ($Environment -eq "production") {
        Deploy-Production
    } else {
        Deploy-Staging
    }
}

# Production deployment
function Deploy-Production {
    Write-Host "Performing blue-green deployment..." -ForegroundColor Yellow
    
    $env:IMAGE_TAG = $Version
    
    # Deploy new version alongside current
    docker-compose -f docker-compose.prod.yml up -d --scale app=2
    
    # Health check new instances
    Write-Host "Performing health checks..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 10
        if ($response.StatusCode -ne 200) {
            throw "Health check failed"
        }
    } catch {
        Write-Host "Health check failed, rolling back..." -ForegroundColor Red
        docker-compose -f docker-compose.prod.yml down
        exit 1
    }
    
    # Remove old instances
    docker-compose -f docker-compose.prod.yml up -d --scale app=1
    
    Write-Host "✓ Production deployment completed" -ForegroundColor Green
}

# Staging deployment
function Deploy-Staging {
    Write-Host "Deploying to staging..." -ForegroundColor Yellow
    
    $env:IMAGE_TAG = $Version
    docker-compose -f docker-compose.staging.yml down
    docker-compose -f docker-compose.staging.yml up -d
    
    Start-Sleep -Seconds 20
    
    try {
        $response = Invoke-WebRequest -Uri "http://staging.yourdomain.com/health" -TimeoutSec 10
        if ($response.StatusCode -ne 200) {
            throw "Health check failed"
        }
    } catch {
        Write-Host "Staging deployment health check failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Staging deployment completed" -ForegroundColor Green
}

# Rollback function
function Invoke-Rollback {
    param([string]$PreviousVersion = "previous")
    
    Write-Host "Rolling back to version: $PreviousVersion" -ForegroundColor Yellow
    
    $env:IMAGE_TAG = $PreviousVersion
    
    if ($Environment -eq "production") {
        docker-compose -f docker-compose.prod.yml up -d
    } else {
        docker-compose -f docker-compose.staging.yml up -d
    }
    
    Write-Host "✓ Rollback completed" -ForegroundColor Green
}

# Cleanup old images
function Invoke-Cleanup {
    Write-Host "Cleaning up old Docker images..." -ForegroundColor Yellow
    
    docker image prune -a --filter "until=168h" -f
    
    Write-Host "✓ Cleanup completed" -ForegroundColor Green
}

# Main execution
switch ($Action) {
    "deploy" {
        Test-EnvironmentVariables
        Build-Image
        Push-Image
        Invoke-Migrations
        Deploy-Application
        Invoke-Cleanup
    }
    "rollback" {
        Invoke-Rollback $Version
    }
    "cleanup" {
        Invoke-Cleanup
    }
    default {
        Write-Host "Usage: .\deploy.ps1 [deploy|rollback|cleanup] [staging|production] [version]"
        Write-Host "  deploy:   Deploy application (default)"
        Write-Host "  rollback: Rollback to previous version"
        Write-Host "  cleanup:  Clean up old Docker images"
    }
}