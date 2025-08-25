import { VercelRequest, VercelResponse } from '@vercel/node';

const demoNotaries = [
  {
    id: 1,
    userId: 1,
    registryNumber: "NOT-2024-001",
    licenseNumber: "LIC-12345-CL",
    jurisdiction: "Región Metropolitana, Chile",
    specializations: [
      "Contratos Inmobiliarios",
      "Poderes Notariales",
      "Constitución de Sociedades",
      "Testamentos",
      "Escrituras Públicas"
    ],
    officeAddress: "Av. Providencia 1234, Oficina 567, Providencia, Santiago",
    officePhone: "+56 2 2234 5678",
    officeEmail: "notario@docusignpro.com",
    website: "https://notario.docusignpro.com",
    bio: "Notario Público con más de 15 años de experiencia en derecho civil y comercial. Especialista en transacciones inmobiliarias y constitución de empresas.",
    serviceArea: ["Santiago", "Providencia", "Las Condes", "Vitacura", "Ñuñoa"],
    isActive: true,
    digitalSealId: "seal_abc123def456",
    digitalSealExpiry: "2025-12-31T23:59:59.000Z",
    verificationStatus: "verified",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: new Date().toISOString(),
    userName: "Dr. Carlos Alberto Fuentes",
    userEmail: "carlos.fuentes@notarios.cl",
    services: [
      {
        id: "svc_1",
        serviceName: "Notarización de Documentos",
        description: "Certificación notarial de documentos privados",
        basePrice: 15000,
        estimatedDuration: 30,
        availableRemotely: false
      },
      {
        id: "svc_2",
        serviceName: "Verificación de Identidad",
        description: "Verificación presencial de identidad para documentos",
        basePrice: 8000,
        estimatedDuration: 15,
        availableRemotely: true
      },
      {
        id: "svc_3",
        serviceName: "Sesiones RON",
        description: "Notarización remota online con video",
        basePrice: 35000,
        estimatedDuration: 60,
        availableRemotely: true
      }
    ],
    stats: {
      totalNotarizations: Math.floor(Math.random() * 200) + 150,
      thisMonthNotarizations: Math.floor(Math.random() * 30) + 20,
      totalRevenue: Math.floor(Math.random() * 5000000) + 3000000,
      thisMonthRevenue: Math.floor(Math.random() * 800000) + 400000,
      averageRating: 4.8,
      completionRate: 98.5,
      upcomingAppointments: Math.floor(Math.random() * 8) + 3
    }
  },
  {
    id: 2,
    userId: 2,
    registryNumber: "NOT-2024-002",
    licenseNumber: "LIC-67890-CL",
    jurisdiction: "Región de Valparaíso, Chile",
    specializations: [
      "Derecho Marítimo",
      "Contratos Comerciales",
      "Poderes Internacionales",
      "Sociedades Anónimas"
    ],
    officeAddress: "Av. Brasil 2567, Valparaíso",
    officePhone: "+56 32 2345 6789",
    officeEmail: "notario.valparaiso@docusignpro.com",
    bio: "Notario especializado en derecho marítimo y comercial internacional. Certificado para RON transfronterizo.",
    serviceArea: ["Valparaíso", "Viña del Mar", "Concón", "Quilpué"],
    isActive: true,
    digitalSealId: "seal_def456ghi789",
    digitalSealExpiry: "2025-11-30T23:59:59.000Z",
    verificationStatus: "verified",
    createdAt: "2024-02-01T09:00:00.000Z",
    updatedAt: new Date().toISOString(),
    userName: "Dra. María Elena Rodríguez",
    userEmail: "maria.rodriguez@notarios.cl",
    services: [
      {
        id: "svc_4",
        serviceName: "Contratos Marítimos",
        description: "Especialización en documentos de comercio marítimo",
        basePrice: 25000,
        estimatedDuration: 45,
        availableRemotely: true
      },
      {
        id: "svc_5",
        serviceName: "RON Internacional",
        description: "Notarización remota para clientes internacionales",
        basePrice: 45000,
        estimatedDuration: 75,
        availableRemotely: true
      }
    ],
    stats: {
      totalNotarizations: Math.floor(Math.random() * 150) + 100,
      thisMonthNotarizations: Math.floor(Math.random() * 25) + 15,
      totalRevenue: Math.floor(Math.random() * 4000000) + 2500000,
      thisMonthRevenue: Math.floor(Math.random() * 600000) + 300000,
      averageRating: 4.9,
      completionRate: 99.2,
      upcomingAppointments: Math.floor(Math.random() * 6) + 2
    }
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
    const { search, jurisdiction, specialization } = req.query;
    
    let notaries = [...demoNotaries];
    
    // Filtrar por búsqueda
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      notaries = notaries.filter(notary => 
        notary.userName.toLowerCase().includes(searchTerm) ||
        notary.jurisdiction.toLowerCase().includes(searchTerm) ||
        notary.specializations.some(s => s.toLowerCase().includes(searchTerm))
      );
    }
    
    // Filtrar por jurisdicción
    if (jurisdiction) {
      notaries = notaries.filter(notary => 
        notary.jurisdiction.toLowerCase().includes((jurisdiction as string).toLowerCase())
      );
    }
    
    // Filtrar por especialización
    if (specialization) {
      notaries = notaries.filter(notary =>
        notary.specializations.some(s => 
          s.toLowerCase().includes((specialization as string).toLowerCase())
        )
      );
    }
    
    res.status(200).json(notaries);
  } catch (error) {
    console.error('Error obteniendo notarios:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}