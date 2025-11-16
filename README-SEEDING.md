# Database Seeding Guide

This guide explains how to seed the PostgreSQL database with initial NPC and game configuration data.

## Overview

The seeding script populates the database with:
- **NPCs**: **3** NPCs from `src/data/npcs.json`
- **Game Configs**: **3** difficulty presets (Easy, Normal, Hard)

## Prerequisites

1. PostgreSQL database must be running and accessible
2. Database connection configured via environment variables or defaults
3. Database tables must be initialized (happens automatically on first connection)

## Environment Variables

The seeding script uses the same database connection settings as the main application:

```bash
# Option 1: Full connection string
DATABASE_URL=postgresql://user:password@host:port/database

# Option 2: Individual variables
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=three_tribes_chronicle
DB_SSL=false
```

## Running the Seeding Script

### Local Development

```bash
# Build and run the seeding script
npm run seed
```

### With Docker Compose

If you're using Docker Compose, make sure the database is running first:

```bash
# Start the database
docker-compose up -d postgres

# Wait a few seconds for PostgreSQL to be ready, then seed
npm run seed
```

### Manual Execution

```bash
# Build TypeScript
npm run build

# Run the seeding script
node dist/scripts/seed-database.js
```

## What Gets Seeded

### NPCs (from `src/data/npcs.json`)

The script seeds all NPCs defined in the JSON file:

- **Rena** - Merchant (Stonefang) - Friendly
- **Gorak** - Warrior (Stonefang) - Neutral  
- **Thorn** - Elder (Stonefang) - Hostile

Each NPC includes:
- Basic info (name, tribe, role, disposition)
- Stats (str, dex, wis, cha, luck)
- Level and XP
- Location coordinates
- Relationship status
- Growth path

### Game Configurations

Three difficulty presets are seeded:

#### 1. Default/Normal (`config_key: 'default'`)
- Encounter Chance: 40%
- XP Multiplier: 1.0x
- Base Stamina: 5
- Season Length: 30 days
- All other settings at normal values

#### 2. Easy (`config_key: 'easy'`)
- Encounter Chance: 50%
- XP Multiplier: 1.5x
- Base Stamina: 7
- Action Success Bonus: +10%
- Action Reward Multiplier: 1.2x
- Relationship Gain Multiplier: 1.3x

#### 3. Hard (`config_key: 'hard'`)
- Encounter Chance: 30%
- XP Multiplier: 0.7x
- Base Stamina: 4
- Action Success Bonus: -5%
- Action Reward Multiplier: 0.8x
- Relationship Gain Multiplier: 0.8x

## Verifying the Seed

After running the seeding script, you can verify the data was inserted:

### Using psql

```bash
# Connect to the database
psql -U postgres -d three_tribes_chronicle

# Check NPCs
SELECT npc_id, data->>'name' as name, data->>'role' as role FROM npcs;

# Check Game Configs
SELECT config_key, config_data->>'difficulty' as difficulty FROM game_configs;
```

### Using the Application

The seeded data will be automatically loaded when:
- Starting a new game (NPCs and default config)
- Loading game settings from the Game Master panel
- Accessing NPC management page

## Re-seeding

The seeding script is **idempotent** - you can run it multiple times safely:

- **NPCs**: Existing NPCs are deleted and re-inserted (based on `npc_id`)
- **Game Configs**: Existing configs are updated (based on `config_key`)

To completely reset:

```bash
# Option 1: Drop and recreate tables (via application restart)
# The application will recreate tables on initialization

# Option 2: Manually delete data
psql -U postgres -d three_tribes_chronicle -c "DELETE FROM npcs; DELETE FROM game_configs;"

# Then re-seed
npm run seed
```

## Troubleshooting

### Connection Errors

```
Error: connect ECONNREFUSED
```

**Solution**: Make sure PostgreSQL is running and connection settings are correct.

### Permission Errors

```
Error: permission denied for table npcs
```

**Solution**: Ensure the database user has proper permissions:
```sql
GRANT ALL PRIVILEGES ON TABLE npcs TO your_user;
GRANT ALL PRIVILEGES ON TABLE game_configs TO your_user;
```

### File Not Found

```
Error: ENOENT: no such file or directory, open 'src/data/npcs.json'
```

**Solution**: Make sure you're running the script from the project root directory.

### Type Errors

```
Error: NPCs data must be an array
```

**Solution**: Verify `src/data/npcs.json` is valid JSON with an array of NPC objects.

## Customization

### Adding More NPCs

Edit `src/data/npcs.json` and add new NPC objects following the existing structure:

```json
{
  "id": "npc_04",
  "name": "NewNPC",
  "tribe": "Windveil",
  "role": "Hunter",
  "disposition": "Friendly",
  ...
}
```

Then run `npm run seed` again.

### Custom Game Configs

You can create custom game configurations by modifying the seeding script or using the Game Master panel in the web UI, which will save to the database automatically.

## Integration with Docker

If using Docker Compose, you can add seeding to your startup process:

```yaml
# In docker-compose.yml, add a seed service
services:
  seed:
    build: .
    command: npm run seed
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/three_tribes_chronicle
```

Then run: `docker-compose up seed`

