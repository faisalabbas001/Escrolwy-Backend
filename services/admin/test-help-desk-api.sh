#!/bin/bash

# Help Desk API Test Script
# Runs the TypeScript test script using ts-node

echo "🧪 Running Help Desk API Tests..."
echo ""

# Check if API_BASE_URL is set, otherwise use default
API_BASE_URL=${API_BASE_URL:-"http://localhost:3002/api/v1"}
export API_BASE_URL

# Run the test script
npx ts-node --transpile-only src/test/test-help-desk-api.ts

exit_code=$?

if [ $exit_code -eq 0 ]; then
  echo ""
  echo "✅ All tests passed!"
else
  echo ""
  echo "❌ Tests failed with exit code: $exit_code"
fi

exit $exit_code
