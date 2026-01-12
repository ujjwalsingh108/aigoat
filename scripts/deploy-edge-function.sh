#!/bin/bash

# Deploy Updated Hyper-Action Edge Function to Supabase
# This script deploys the edge function that fetches historical data for all 2515 NSE equity stocks

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║  📤 DEPLOYING HYPER-ACTION EDGE FUNCTION                  ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

echo "✅ Supabase CLI installed"
echo ""

# Check if logged in
echo "🔐 Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please login first:"
    echo ""
    supabase login
fi

echo "✅ Authenticated with Supabase"
echo ""

# Link to project (if not already linked)
echo "🔗 Linking to Supabase project..."
if [ ! -f ".supabase/config.toml" ]; then
    supabase link --project-ref kowxpazskkigzwdwzwyq
    echo "✅ Linked to project kowxpazskkigzwdwzwyq"
else
    echo "✅ Already linked to project"
fi
echo ""

# Deploy the function
echo "🚀 Deploying hyper-action edge function..."
supabase functions deploy hyper-action --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║  ✅ DEPLOYMENT SUCCESSFUL                                 ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📊 Edge Function Details:"
    echo "   • Name: hyper-action"
    echo "   • Symbols: 2515 NSE equity stocks"
    echo "   • Table: kite_nse_equity_symbols"
    echo "   • Trigger: Cron job every 5 minutes"
    echo ""
    echo "🔗 Function URL:"
    echo "   https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action"
    echo ""
    echo "📝 Test the function:"
    echo '   curl -X POST https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action \\'
    echo '     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \\'
    echo '     -H "Content-Type: application/json"'
    echo ""
    echo "📋 View logs:"
    echo "   supabase functions logs hyper-action"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi
