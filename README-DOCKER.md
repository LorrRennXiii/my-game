# Docker Setup

This guide explains how to run the Three Tribes Chronicle game with Docker Compose, which includes PostgreSQL database.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Node.js and npm (for local development, optional if using Docker)

## Quick Start

### 1. Start Everything with Docker Compose

```bash
# Start PostgreSQL and the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down

# Stop and remove volumes (deletes database data)
docker-compose down -v
```

### 2. Access the Application

- **Game**: http://localhost:3000
- **PostgreSQL**: localhost:5432
  - User: `postgres`
  - Password: `postgres`
  - Database: `three_tribes_chronicle`

## Development Workflow

### Option 1: Run Everything in Docker

```bash
# Build and start
docker-compose up --build

# Rebuild after code changes
docker-compose build app
docker-compose up -d app
```

### Option 2: Run Database in Docker, App Locally

```bash
# Start only PostgreSQL
docker-compose up -d postgres

# Set environment variables for local app
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/three_tribes_chronicle

# Run app locally
npm install
npm run build
npm start
```

Or create a `.env` file:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/three_tribes_chronicle
```

## Docker Commands

```bash
# Start services in background
npm run docker:up

# Stop services
npm run docker:down

# View logs
npm run docker:logs

# Rebuild containers
npm run docker:build

# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d three_tribes_chronicle

# Access application container shell
docker-compose exec app sh
```

## Database Persistence

Database data is stored in a Docker volume named `postgres_data`. This means:

- Data persists between container restarts
- To completely reset: `docker-compose down -v`
- To backup: `docker-compose exec postgres pg_dump -U postgres three_tribes_chronicle > backup.sql`
- To restore: `docker-compose exec -T postgres psql -U postgres three_tribes_chronicle < backup.sql`

## Troubleshooting

### Database Connection Issues

If the app can't connect to the database:

1. Check if PostgreSQL is running:
   ```bash
   docker-compose ps
   ```

2. Check PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

3. Verify connection from app container:
   ```bash
   docker-compose exec app sh
   # Inside container:
   apk add postgresql-client
   psql postgresql://postgres:postgres@postgres:5432/three_tribes_chronicle
   ```

### Port Already in Use

If port 3000 or 5432 is already in use:

1. Change ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "3001:3000"  # Use 3001 instead of 3000
     - "5433:5432"  # Use 5433 instead of 5432
   ```

2. Update `DATABASE_URL` if you changed PostgreSQL port:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/three_tribes_chronicle
   ```

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose up --build -d

# Or just restart (if no code changes)
docker-compose restart app
```

## Environment Variables

You can override default values by creating a `.env` file or setting environment variables:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/three_tribes_chronicle
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=three_tribes_chronicle
DB_SSL=false

# Application
PORT=3000
```

## Production Considerations

For production deployment:

1. **Change default passwords** in `docker-compose.yml`
2. **Use secrets management** (Docker secrets, Kubernetes secrets, etc.)
3. **Enable SSL** for database connections
4. **Set up proper backups** for the database volume
5. **Use environment-specific configurations**
6. **Consider using a managed database service** (AWS RDS, Google Cloud SQL, etc.)

## Clean Up

```bash
# Stop and remove containers
docker-compose down

# Stop, remove containers, and delete volumes (⚠️ deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

