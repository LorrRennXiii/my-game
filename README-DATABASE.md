# Database Setup

This game uses PostgreSQL to store permanent NPC and Game Master settings.

## Setup Instructions

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE three_tribes_chronicle;

# Exit psql
\q
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update with your database credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=three_tribes_chronicle
DB_SSL=false
```

Or use a connection string:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/three_tribes_chronicle
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Server

The database tables will be created automatically on first run:

```bash
npm run build
npm start
```

## Fallback Behavior

If the database is not available or not configured, the application will:
- Fall back to localStorage for storing NPCs and config
- Display appropriate messages to the user
- Continue functioning normally

## API Endpoints

### NPCs
- `POST /api/database/npcs` - Save permanent NPCs
- `GET /api/database/npcs` - Load permanent NPCs

### Game Config
- `POST /api/database/config` - Save game config
- `GET /api/database/config` - Load game config

## Troubleshooting

**Database connection errors:**
- Check that PostgreSQL is running: `pg_isready`
- Verify credentials in `.env` file
- Ensure database exists: `psql -U postgres -l`

**Tables not created:**
- Check server logs for initialization errors
- Manually run the SQL from `src/core/database.ts` if needed

