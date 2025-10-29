#!/bin/bash

echo "🚀 Setting up Oracle Fusion Purchase Requisition API..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your Oracle Fusion credentials"
else
    echo "✅ .env file already exists"
fi

# Create uploads directory
mkdir -p uploads
echo "✅ Created uploads directory"

# Create .gitkeep for uploads
touch uploads/.gitkeep

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Oracle Fusion credentials"
echo "2. Start PostgreSQL and Redis: docker-compose up -d postgres redis"
echo "3. Start the application: npm run start:dev"
echo "4. Access Swagger documentation: http://localhost:3000/docs"
echo ""
echo "For more information, see README.md"

