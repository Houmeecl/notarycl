import { VercelRequest, VercelResponse } from '@vercel/node';

const demoPaymentProviders = [
  {
    id: "stripe",
    name: "Stripe",
    type: "stripe",
    isActive: true,
    supportedCurrencies: ["CLP", "USD", "EUR"],
    fees: { percentage: 3.4, fixedAmount: 300, currency: "CLP" },
    processingTime: "instant",
    supportedMethods: ["credit_card", "debit_card"],
    logo: "https://stripe.com/img/v3/home/social.png",
    description: "Procesador de pagos internacional líder"
  },
  {
    id: "paypal",
    name: "PayPal",
    type: "paypal",
    isActive: true,
    supportedCurrencies: ["CLP", "USD"],
    fees: { percentage: 4.0, fixedAmount: 0, currency: "CLP" },
    processingTime: "instant",
    supportedMethods: ["paypal_account", "credit_card"],
    logo: "https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg",
    description: "Plataforma de pagos global más confiable"
  },
  {
    id: "mercadopago",
    name: "MercadoPago",
    type: "mercadopago",
    isActive: true,
    supportedCurrencies: ["CLP", "ARS", "USD"],
    fees: { percentage: 2.9, fixedAmount: 200, currency: "CLP" },
    processingTime: "instant",
    supportedMethods: ["credit_card", "debit_card", "bank_transfer"],
    logo: "https://http2.mlstatic.com/frontend-assets/ui-navigation/5.18.9/mercadolibre/logo__large_plus.png",
    description: "Líder en pagos digitales en Latinoamérica"
  },
  {
    id: "webpay",
    name: "WebPay Plus",
    type: "webpay",
    isActive: true,
    supportedCurrencies: ["CLP"],
    fees: { percentage: 2.5, fixedAmount: 150, currency: "CLP" },
    processingTime: "instant",
    supportedMethods: ["credit_card", "debit_card"],
    logo: "https://www.transbankdevelopers.cl/img/logo-webpay.svg",
    description: "Procesador oficial de pagos en Chile"
  }
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { currency = "CLP" } = req.query;
    
    // Filtrar proveedores por moneda soportada
    const availableProviders = demoPaymentProviders.filter(provider => 
      provider.isActive && provider.supportedCurrencies.includes(currency as string)
    );
    
    res.status(200).json(availableProviders);
  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}