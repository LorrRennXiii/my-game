# Industrial-Standard Save System

## Overview

This game implements a professional, database-backed save system with multiple save slots, auto-save functionality, and comprehensive metadata tracking. The system is designed to be scalable, reliable, and user-friendly.

## Features

### ✅ Core Features

1. **Multiple Save Slots** (1-10 slots per user)
   - Each slot can store a complete game state
   - Empty slots are clearly marked
   - Save metadata displayed for each slot

2. **Auto-Save**
   - Automatic saves every 5 minutes during gameplay
   - Auto-save before ending each day
   - Uses first available slot or slot 1

3. **Save Metadata**
   - Character name, level, tribe
   - Current day
   - Total playtime
   - Save timestamp
   - Auto-save indicator

4. **Database-Backed Storage**
   - PostgreSQL database for persistent storage
   - JSONB for efficient game state storage
   - Indexed for fast queries
   - Transaction-safe operations

5. **Save Validation**
   - Validates save data structure on load
   - Version compatibility checking
   - Error handling and recovery

6. **Playtime Tracking**
   - Accurate playtime calculation
   - Persisted across sessions
   - Displayed in save slots

## Architecture

### Backend (`src/core/saveService.ts`)

The `SaveService` class handles all database operations:

```typescript
- saveGame(): Save game to a specific slot
- loadGame(): Load game from a specific slot
- getSaveSlots(): Get all save slots for a user
- deleteSave(): Delete a save slot
- getAutoSave(): Get the most recent auto-save
- updatePlaytime(): Update playtime for a save
```

### Database Schema

```sql
CREATE TABLE game_saves (
  id SERIAL PRIMARY KEY,
  save_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  slot_number INTEGER NOT NULL,
  save_name VARCHAR(255) NOT NULL,
  character_name VARCHAR(255) NOT NULL,
  character_level INTEGER NOT NULL,
  character_tribe VARCHAR(100) NOT NULL,
  day INTEGER NOT NULL,
  playtime INTEGER NOT NULL DEFAULT 0,
  is_auto_save BOOLEAN NOT NULL DEFAULT false,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  save_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_slot UNIQUE (user_id, slot_number)
)
```

### Frontend (`public/save-manager.js`)

The frontend save manager provides:

- Save slots UI modal
- Save/load/delete operations
- Auto-save integration
- Playtime formatting
- Timestamp formatting

### API Endpoints

```
GET    /api/saves/:userId                    - Get all save slots
POST   /api/saves/:userId/slot/:slotNumber   - Save to slot
POST   /api/saves/:userId/slot/:slotNumber/load - Load from slot
DELETE /api/saves/:userId/slot/:slotNumber    - Delete slot
GET    /api/saves/:userId/autosave            - Get auto-save
POST   /api/saves/:userId/playtime           - Update playtime
```

## Usage

### Saving a Game

1. **Manual Save**: Click the "Save" button in-game
   - Opens save slots modal
   - Choose an empty slot or overwrite existing
   - Save is immediate

2. **Auto-Save**: Automatic
   - Every 5 minutes during gameplay
   - Before ending each day
   - Uses first available slot

### Loading a Game

1. Click "Load Game" from start screen OR
2. Use save slots modal during gameplay
3. Select a save slot
4. Game loads immediately

### Save Slot Information

Each save slot displays:
- **Slot Number**: 1-10
- **Save Name**: User-defined or "Auto-Save"
- **Character**: Name and tribe
- **Level & Day**: Current progression
- **Playtime**: Total time played
- **Last Saved**: Relative timestamp

## Technical Details

### Save Data Structure

```typescript
interface SaveData {
  player: Player
  tribe: Tribe
  npcs: NPC[]
  day: number
  timestamp: number
  worldState?: WorldState
  lastNPCEncounters?: Record<string, { day: number; level: number }>
  gameConfig?: Partial<GameConfig>
}
```

### Save Metadata

```typescript
interface SaveMetadata {
  saveId: string
  userId: string
  slotNumber: number
  saveName: string
  characterName: string
  characterLevel: number
  characterTribe: string
  day: number
  playtime: number
  timestamp: number
  isAutoSave: boolean
  version: string
}
```

### Playtime Tracking

- Tracks time per session
- Accumulates across sessions
- Updated on every action/end day
- Stored in database

### Version Compatibility

- Current version: `1.0.0`
- Future versions can add migration logic
- Validation ensures save integrity

## Best Practices

1. **Always Auto-Save**: Enabled by default
2. **Manual Saves**: Use before major decisions
3. **Multiple Slots**: Use different slots for different playthroughs
4. **Regular Backups**: Database backups recommended for production

## Error Handling

- Database connection failures: Graceful fallback
- Invalid save data: Clear error messages
- Missing saves: User-friendly notifications
- Network errors: Retry logic

## Performance

- Indexed database queries
- Efficient JSONB storage
- Minimal data transfer
- Fast load times (< 100ms typical)

## Future Enhancements

- Cloud save sync
- Save compression for large states
- Save thumbnails/screenshots
- Save sharing between users
- Save export/import
- Save versioning with rollback

## Troubleshooting

### Save Not Appearing
- Check database connection
- Verify user ID is correct
- Check browser console for errors

### Auto-Save Not Working
- Ensure save manager is initialized
- Check session ID is valid
- Verify database is accessible

### Load Fails
- Check save data integrity
- Verify save version compatibility
- Check database connection

## Integration

The save system integrates seamlessly with:
- Game loop (`src/gameLoop.ts`)
- Server API (`src/server.ts`)
- Frontend UI (`public/app.js`)
- Database manager (`src/core/database.ts`)

## Security

- User ID validation
- Save data validation
- SQL injection prevention (parameterized queries)
- Transaction safety

---

**Note**: This save system follows industry best practices used in commercial games, ensuring reliability, performance, and user experience.

