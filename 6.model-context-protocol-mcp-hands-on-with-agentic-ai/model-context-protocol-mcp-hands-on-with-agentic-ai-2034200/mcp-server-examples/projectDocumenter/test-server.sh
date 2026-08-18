#!/bin/bash

# Build the project
echo "Building DocWriter MCP server..."
npm run build

# Check if a test directory was provided
if [ "$1" ]; then
  TEST_DIR="$1"
  echo "Testing with project directory: $TEST_DIR"
else
  # Create a temp test directory if none was provided
  TEST_DIR="$(mktemp -d)"
  echo "Created temporary test directory: $TEST_DIR"
  
  # Create some sample files
  echo "Creating sample project files..."
  mkdir -p "$TEST_DIR/src"
  mkdir -p "$TEST_DIR/config"
  
  # Sample main file
  cat > "$TEST_DIR/src/index.js" << 'EOF'
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
EOF

  # Sample config file
  cat > "$TEST_DIR/config/config.json" << 'EOF'
{
  "name": "sample-project",
  "version": "1.0.0",
  "description": "A sample project for testing DocWriter"
}
EOF

  # Sample README stub
  cat > "$TEST_DIR/README.md" << 'EOF'
# Sample Project

This is a minimal README.
EOF

  # Sample .gitignore
  cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
.env
EOF
fi

# Test the server using MCP Inspector
echo "Starting MCP Inspector to test the DocWriter server..."
echo "Try using the 'generate-readme' tool with projectPath: $TEST_DIR"
npx @modelcontextprotocol/inspector node dist/index.js

# Clean up if we created a temporary directory
if [ -z "$1" ]; then
  echo "Cleaning up temporary test directory..."
  rm -rf "$TEST_DIR"
fi