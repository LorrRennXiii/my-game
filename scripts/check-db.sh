#!/bin/bash
# Quick database connection check script

echo "🔍 Checking database connection..."

# Check if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "   Using DATABASE_URL"
    # Extract connection details (mask password)
    DB_INFO=$(echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/')
    echo "   Connection: $DB_INFO"
else
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-three_tribes_chronicle}
    DB_USER=${DB_USER:-postgres}
    
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
fi

echo ""
echo "Testing connection..."

# Try to connect using psql if available
if command -v psql &> /dev/null; then
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1
    else
        PGPASSWORD=${DB_PASSWORD:-postgres} psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Connection successful!"
        echo ""
        echo "Database is ready for seeding."
    else
        echo "❌ Connection failed!"
        echo ""
        echo "💡 Make sure:"
        echo "   1. PostgreSQL is running"
        echo "   2. Database exists: createdb $DB_NAME"
        echo "   3. Connection settings are correct"
        exit 1
    fi
else
    echo "⚠️  psql not found - skipping connection test"
    echo "   Install PostgreSQL client tools to test connection"
fi

