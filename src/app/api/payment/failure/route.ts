import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const txnid = formData.get('txnid');
  const error = formData.get('error_Message');

  const url = new URL('/billing', process.env.NEXT_PUBLIC_APP_URL!);
  url.searchParams.set('payment', 'failed');
  url.searchParams.set('error', error as string);

  return NextResponse.redirect(url);
}
