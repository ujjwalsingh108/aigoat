import crypto from 'crypto';

interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  baseUrl: string;
}

interface PaymentParams {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export class PayUClient {
  private config: PayUConfig;

  constructor() {
    this.config = {
      merchantKey: process.env.PAYU_MERCHANT_KEY!,
      merchantSalt: process.env.PAYU_MERCHANT_SALT!,
      baseUrl: process.env.PAYU_BASE_URL!,
    };

    if (!this.config.merchantKey || !this.config.merchantSalt) {
      throw new Error('PayU credentials not configured');
    }
  }

  generateHash(params: PaymentParams): string {
    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
    } = params;

    const hashString = [
      this.config.merchantKey,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      '', '', '', '', '',
      this.config.merchantSalt,
    ].join('|');

    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  verifyWebhookSignature(payload: any): boolean {
    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      hash: receivedHash,
    } = payload;

    const hashString = [
      this.config.merchantSalt,
      status,
      '', '', '', '', '',
      udf5,
      udf4,
      udf3,
      udf2,
      udf1,
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      this.config.merchantKey,
    ].join('|');

    const calculatedHash = crypto
      .createHash('sha512')
      .update(hashString)
      .digest('hex');

    return calculatedHash === receivedHash;
  }

  getPaymentUrl(params: PaymentParams): {
    url: string;
    payload: Record<string, string>;
  } {
    const hash = this.generateHash(params);

    return {
      url: `${this.config.baseUrl}/_payment`,
      payload: {
        key: this.config.merchantKey,
        txnid: params.txnid,
        amount: params.amount,
        productinfo: params.productinfo,
        firstname: params.firstname,
        email: params.email,
        phone: params.phone,
        surl: params.surl,
        furl: params.furl,
        hash,
        ...(params.udf1 && { udf1: params.udf1 }),
        ...(params.udf2 && { udf2: params.udf2 }),
        ...(params.udf3 && { udf3: params.udf3 }),
        ...(params.udf4 && { udf4: params.udf4 }),
        ...(params.udf5 && { udf5: params.udf5 }),
      },
    };
  }
}
