import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const txnid = formData.get('txnid');

  const url = new URL('/billing', process.env.NEXT_PUBLIC_APP_URL!);
  url.searchParams.set('payment', 'success');
  url.searchParams.set('txnid', txnid as string);

  return NextResponse.redirect(url);
}
