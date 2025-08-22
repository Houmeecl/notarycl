import { VercelRequest, VercelResponse } from '@vercel/node';

const demoEvents = [
  {
    type: 'document_created',
    title: 'Nuevo Documento Creado',
    descriptions: [
      'Contrato de servicios profesionales iniciado',
      'Poder notarial para operaciones bancarias',
      'Contrato de arrendamiento comercial',
      'Escritura de compraventa inmobiliaria',
      'Mandato para gestión de inversiones'
    ],
    importance: 'medium',
    users: ['Ana Patricia Silva', 'Roberto Empresario Pérez', 'María José Contreras', 'Carlos Alberto Fuentes']
  },
  {
    type: 'payment_completed',
    title: 'Pago Procesado',
    descriptions: [
      '$35,000 CLP procesado vía MercadoPago',
      '$45,000 CLP procesado vía Stripe',
      '$25,000 CLP procesado vía WebPay',
      '$55,000 CLP procesado vía PayPal',
      '$30,000 CLP procesado vía Transferencia'
    ],
    importance: 'high',
    users: ['Cliente Premium', 'Empresa Constructora', 'Estudio Jurídico', 'Inmobiliaria Norte']
  },
  {
    type: 'ron_session_started',
    title: 'Sesión RON Iniciada',
    descriptions: [
      'Notarización remota en progreso con 3 participantes',
      'Sesión internacional Chile-Argentina activa',
      'Poder notarial urgente en proceso RON',
      'Constitución de sociedad vía RON',
      'Testamento vital por notarización remota'
    ],
    importance: 'high',
    users: ['Dr. Carlos Fuentes', 'Notaría Santiago Centro', 'Notario Internacional']
  },
  {
    type: 'identity_verified',
    title: 'Identidad Verificada',
    descriptions: [
      'Verificación biométrica completada (Score: 96%)',
      'Análisis de cédula aprobado (Score: 94%)',
      'Detección de vida exitosa (Score: 98%)',
      'KBA completado satisfactoriamente (Score: 92%)',
      'Verificación multi-método aprobada (Score: 95%)'
    ],
    importance: 'medium',
    users: ['Usuario Verificado', 'Cliente Internacional', 'Empresa Validada']
  },
  {
    type: 'document_signed',
    title: 'Documento Firmado',
    descriptions: [
      'Firma digital aplicada exitosamente',
      'Firma biométrica validada y aplicada',
      'Firma con timestamp y geolocalización',
      'Firma múltiple completada (3/3)',
      'Firma notarial digital aplicada'
    ],
    importance: 'medium',
    users: ['Firmante Autorizado', 'Representante Legal', 'Apoderado General']
  },
  {
    type: 'notarization_completed',
    title: 'Notarización Completada',
    descriptions: [
      'Certificado notarial generado y entregado',
      'Sello digital aplicado exitosamente',
      'Registro notarial actualizado',
      'Certificado RON emitido',
      'Escritura pública digitalizada'
    ],
    importance: 'high',
    users: ['Notario Certificado', 'Sistema Notarial', 'Registro Nacional']
  },
  {
    type: 'workflow_advanced',
    title: 'Flujo Avanzado',
    descriptions: [
      'Workflow empresarial completado en 47 minutos',
      'Proceso express finalizado exitosamente',
      'Flujo RON completado con certificación',
      'Automatización de reglas de negocio aplicada',
      'Escalación automática por alta prioridad'
    ],
    importance: 'high',
    users: ['Sistema Automático', 'Motor de Workflow', 'IA DocuSignPro']
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
    // Seleccionar evento aleatorio
    const randomEvent = demoEvents[Math.floor(Math.random() * demoEvents.length)];
    const randomDescription = randomEvent.descriptions[Math.floor(Math.random() * randomEvent.descriptions.length)];
    const randomUser = randomEvent.users[Math.floor(Math.random() * randomEvent.users.length)];

    const event = {
      id: `demo_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: randomEvent.type,
      title: randomEvent.title,
      description: randomDescription,
      timestamp: new Date().toISOString(),
      user: randomUser,
      importance: randomEvent.importance,
      location: 'Santiago, Chile',
      demo: {
        isDemo: true,
        platform: 'vercel',
        region: 'us-east-1'
      }
    };

    res.status(200).json(event);
  } catch (error) {
    console.error('Error generando evento demo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}