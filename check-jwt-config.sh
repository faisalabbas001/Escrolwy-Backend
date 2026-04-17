#!/bin/bash

# JWT Configuration Verification Script
# This script helps verify JWT configuration across services

echo "=================================="
echo "JWT Configuration Checker"
echo "=================================="
echo ""

# Check auth service .env
echo "📋 Checking Auth Service .env..."
if [ -f "services/auth/.env" ]; then
    echo "✅ Auth service .env exists"
    
    # Check for JWT_SECRET
    if grep -q "JWT_SECRET" services/auth/.env; then
        JWT_SECRET_AUTH=$(grep "JWT_SECRET" services/auth/.env | cut -d'=' -f2)
        echo "✅ JWT_SECRET found in auth service"
        echo "   Length: ${#JWT_SECRET_AUTH} characters"
        if [ "$JWT_SECRET_AUTH" = "default-secret-change-me" ]; then
            echo "   ⚠️  WARNING: Using default JWT secret!"
        fi
    else
        echo "❌ JWT_SECRET missing in auth service"
    fi
else
    echo "❌ Auth service .env not found"
fi

echo ""

# Check reporting service .env  
echo "📋 Checking Reporting Service .env..."
if [ -f "services/reporting/.env" ]; then
    echo "✅ Reporting service .env exists"
    
    # Check for JWT_SECRET
    if grep -q "JWT_SECRET" services/reporting/.env; then
        JWT_SECRET_REPORTING=$(grep "JWT_SECRET" services/reporting/.env | cut -d'=' -f2)
        echo "✅ JWT_SECRET found in reporting service"
        echo "   Length: ${#JWT_SECRET_REPORTING} characters"
        if [ "$JWT_SECRET_REPORTING" = "default-secret-change-me" ]; then
            echo "   ⚠️  WARNING: Using default JWT secret!"
        fi
    else
        echo "❌ JWT_SECRET missing in reporting service"
        echo ""
        echo "🔧 FIX REQUIRED:"
        echo "   Add JWT_SECRET to services/reporting/.env"
        echo "   It must match the value in services/auth/.env"
    fi
else
    echo "❌ Reporting service .env not found"
fi

echo ""

# Compare secrets if both exist
if [ ! -z "$JWT_SECRET_AUTH" ] && [ ! -z "$JWT_SECRET_REPORTING" ]; then
    echo "🔍 Comparing JWT secrets..."
    if [ "$JWT_SECRET_AUTH" = "$JWT_SECRET_REPORTING" ]; then
        echo "✅ JWT secrets MATCH between services"
    else
        echo "❌ JWT secrets DO NOT MATCH"
        echo "   This is why you're getting 401 errors!"
        echo ""
        echo "🔧 FIX:"
        echo "   Update services/reporting/.env to use the same JWT_SECRET as auth service"
    fi
fi

echo ""
echo "=================================="
