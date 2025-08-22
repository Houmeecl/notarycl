import { VercelRequest, VercelResponse } from '@vercel/node';

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
    // Generar estadísticas de demo realistas
    const now = new Date();
    const baseTime = now.getTime();
    
    const demoStats = {
      basic: {
        users: 5,
        documents: 12,
        completedDocuments: 8,
        ronSessions: 3,
        totalRevenue: 185000,
        verificationRate: 98.5
      },
      detailed: {
        realTime: {
          activeUsers: Math.floor(Math.random() * 15) + 5,
          documentsInProgress: Math.floor(Math.random() * 8) + 2,
          completedToday: Math.floor(Math.random() * 25) + 15,
          revenueToday: Math.floor(Math.random() * 500000) + 300000
        },
        performance: {
          averageProcessingTime: Math.floor(Math.random() * 30) + 45,
          successRate: Math.floor(Math.random() * 5) + 95,
          customerSatisfaction: Math.floor(Math.random() * 10) + 90,
          systemUptime: 99.9
        },
        growth: {
          monthlyGrowth: Math.floor(Math.random() * 20) + 15,
          newClientsThisMonth: Math.floor(Math.random() * 50) + 75,
          documentsThisMonth: Math.floor(Math.random() * 200) + 300,
          revenueGrowth: Math.floor(Math.random() * 25) + 20
        }
      },
      timestamp: now.toISOString(),
      demo: {
        mode: "vercel-live",
        lastUpdate: now.toISOString(),
        region: "santiago-chile"
      }
    };

    res.status(200).json(demoStats);
  } catch (error) {
    console.error('Error generando stats de demo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}