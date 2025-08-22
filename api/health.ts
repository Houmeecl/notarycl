import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Simular estadísticas del sistema para demo
  const demoStats = {
    status: "ok",
    message: "DocuSignPro Complete Demo - Live on Vercel",
    timestamp: new Date().toISOString(),
    environment: "vercel-demo",
    version: "3.0.0-vercel-demo",
    uptime: Math.floor(Math.random() * 86400), // Simular uptime
    modules: {
      documents: Math.floor(Math.random() * 50) + 25,
      signatures: Math.floor(Math.random() * 100) + 50,
      notaries: 3,
      payments: Math.floor(Math.random() * 30) + 15,
      ronSessions: Math.floor(Math.random() * 10) + 5,
      identityVerifications: Math.floor(Math.random() * 80) + 40,
      activeWorkflows: Math.floor(Math.random() * 15) + 5,
      securityAlerts: 0
    },
    systemHealth: {
      workflowEngine: {
        activeWorkflows: Math.floor(Math.random() * 15) + 5,
        stuckWorkflows: 0,
        averageProcessingTime: Math.floor(Math.random() * 30) + 45,
        systemLoad: "normal",
        alerts: []
      },
      security: {
        blockedIPs: 0,
        activeSessions: Math.floor(Math.random() * 20) + 10,
        recentThreats: []
      }
    },
    demo: {
      isDemo: true,
      demoMode: "interactive",
      lastUpdated: new Date().toISOString()
    }
  };

  res.status(200).json(demoStats);
}