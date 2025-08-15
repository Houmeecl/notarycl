// Simplified payment service for demo mode
console.warn('Usando servicio de pagos en modo demo - configurar MercadoPago para producción');

export async function createPaymentPreference(
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
    currency_id?: string;
    description?: string;
  }>,
  payer: {
    email: string;
    name?: string;
    identification?: {
      type: string;
      number: string;
    };
  },
  backUrls?: {
    success?: string;
    failure?: string;
    pending?: string;
  },
  externalReference?: string
) {
  return {
    id: `DEMO_PREFERENCE_${Date.now()}`,
    init_point: "/demo-payment",
    sandbox_init_point: "/demo-payment",
    items,
    payer,
    back_urls: backUrls,
    external_reference: externalReference
  };
}

export async function getPaymentInfo(paymentId: string) {
  return {
    id: paymentId,
    status: "approved",
    status_detail: "accredited",
    transaction_amount: 1000,
    currency_id: "CLP"
  };
}

export async function processPayment(paymentData: any) {
  return {
    id: `DEMO_PAYMENT_${Date.now()}`,
    status: "approved",
    status_detail: "accredited",
    transaction_amount: paymentData.transaction_amount,
    currency_id: "CLP"
  };
}

export const MercadoPagoService = {
  createPaymentPreference,
  getPaymentInfo,
  processPayment,
  getPublicKey: () => "DEMO_PUBLIC_KEY",
};