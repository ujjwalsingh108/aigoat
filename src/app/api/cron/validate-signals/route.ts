import { NextRequest, NextResponse } from 'next/server';
import { processBatchAIValidation } from '@/lib/jobs/batch-ai-validation';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting batch AI validation job...');

    // Run the batch validation job
    await processBatchAIValidation();

    return NextResponse.json({
      success: true,
      message: 'Batch AI validation completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Batch AI validation failed:', error);
    return NextResponse.json(
      {
        error: 'Batch validation failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
