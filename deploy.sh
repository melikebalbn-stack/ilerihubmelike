#!/bin/bash
# ILERIHub Production Deploy Script
# Bu script değişikliklerden sonra production build yapar ve restart eder

echo "🔄 Building for production..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    echo "🔄 Restarting PM2..."
    pm2 restart ilerihub
    echo "✅ Deployment complete!"
else
    echo "❌ Build failed! PM2 not restarted."
    exit 1
fi
