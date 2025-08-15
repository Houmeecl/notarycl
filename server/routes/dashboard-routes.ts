import type { Express } from "express";
import { storage } from "../storage";

export function registerDashboardRoutes(app: Express) {
  // Estadísticas para certificadores
  app.get("/api/certifier/stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'certifier') {
      return res.sendStatus(401);
    }

    try {
      const stats = {
        totalDocuments: 15,
        pendingDocuments: 3,
        certifiedToday: 2,
        avgCertificationTime: 2.5,
        efficiency: 94
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting certifier stats:', error);
      res.status(500).json({ error: 'Error getting statistics' });
    }
  });

  // Documentos pendientes para certificadores
  app.get("/api/certifier/pending-documents", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'certifier') {
      return res.sendStatus(401);
    }

    try {
      const pendingDocs = [
        {
          id: 1,
          title: "Contrato de Arrendamiento",
          type: "Contrato",
          status: "pending",
          userId: 5,
          userName: "Juan Pérez",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          priority: "high"
        },
        {
          id: 2,
          title: "Declaración Jurada",
          type: "Declaración",
          status: "pending",
          userId: 8,
          userName: "María González",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          priority: "normal"
        },
        {
          id: 3,
          title: "Poder Notarial",
          type: "Poder",
          status: "pending",
          userId: 12,
          userName: "Carlos Rodríguez",
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          priority: "normal"
        }
      ];
      
      res.json(pendingDocs);
    } catch (error) {
      console.error('Error getting pending documents:', error);
      res.status(500).json({ error: 'Error getting pending documents' });
    }
  });

  // Documentos certificados hoy
  app.get("/api/certifier/today-documents", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'certifier') {
      return res.sendStatus(401);
    }

    try {
      const todayDocs = [
        {
          id: 4,
          title: "Certificado de Antecedentes",
          type: "Certificado",
          status: "certified",
          userId: 15,
          userName: "Ana Silva",
          createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          certifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 5,
          title: "Autorización de Viaje",
          type: "Autorización",
          status: "certified",
          userId: 18,
          userName: "Pedro Morales",
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          certifiedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      res.json(todayDocs);
    } catch (error) {
      console.error('Error getting today documents:', error);
      res.status(500).json({ error: 'Error getting today documents' });
    }
  });

  // Certificar/rechazar documento
  app.post("/api/certifier/certify/:docId", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'certifier') {
      return res.sendStatus(401);
    }

    try {
      const { docId } = req.params;
      const { decision } = req.body;

      if (!['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid decision' });
      }

      // Simular proceso de certificación
      const result = {
        success: true,
        documentId: docId,
        decision: decision,
        certifiedBy: req.user.id,
        certifiedAt: new Date().toISOString()
      };

      res.json(result);
    } catch (error) {
      console.error('Error certifying document:', error);
      res.status(500).json({ error: 'Error certifying document' });
    }
  });

  // Estadísticas para usuarios
  app.get("/api/user/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const stats = {
        totalDocuments: 5,
        certifiedDocuments: 3,
        pendingDocuments: 2,
        totalSpent: 45000
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({ error: 'Error getting user statistics' });
    }
  });

  // Documentos del usuario
  app.get("/api/user/documents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const userDocs = [
        {
          id: 1,
          title: "Mi Certificado de Antecedentes",
          type: "Certificado",
          status: "certified",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          certifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          price: 15000
        },
        {
          id: 2,
          title: "Autorización de Viaje para Menor",
          type: "Autorización",
          status: "certified",
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          certifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          price: 20000
        },
        {
          id: 3,
          title: "Declaración Jurada de Ingresos",
          type: "Declaración",
          status: "pending",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          price: 10000
        }
      ];
      
      res.json(userDocs);
    } catch (error) {
      console.error('Error getting user documents:', error);
      res.status(500).json({ error: 'Error getting user documents' });
    }
  });

  // Servicios disponibles
  app.get("/api/services", async (req, res) => {
    try {
      const services = [
        {
          id: 1,
          name: "Certificado de Antecedentes",
          description: "Certificado oficial de antecedentes penales",
          price: 15000,
          category: "Certificados",
          estimatedTime: "24-48 horas",
          popular: true
        },
        {
          id: 2,
          name: "Autorización de Viaje",
          description: "Autorización notarial para viaje de menores",
          price: 20000,
          category: "Autorizaciones",
          estimatedTime: "1-2 días",
          popular: true
        },
        {
          id: 3,
          name: "Poder Notarial",
          description: "Poder simple o especial ante notario",
          price: 35000,
          category: "Poderes",
          estimatedTime: "2-3 días",
          popular: false
        },
        {
          id: 4,
          name: "Declaración Jurada",
          description: "Declaración jurada de ingresos o situación",
          price: 10000,
          category: "Declaraciones",
          estimatedTime: "1 día",
          popular: false
        },
        {
          id: 5,
          name: "Legalización de Documentos",
          description: "Legalización de documentos extranjeros",
          price: 25000,
          category: "Legalizaciones",
          estimatedTime: "3-5 días",
          popular: false
        },
        {
          id: 6,
          name: "Contrato de Arrendamiento",
          description: "Contrato de arriendo con certificación notarial",
          price: 30000,
          category: "Contratos",
          estimatedTime: "1-2 días",
          popular: true
        }
      ];
      
      res.json(services);
    } catch (error) {
      console.error('Error getting services:', error);
      res.status(500).json({ error: 'Error getting services' });
    }
  });

  // Estadísticas para super admin
  app.get("/api/admin/stats", async (req, res) => {
    if (!req.isAuthenticated() || !['admin', 'superadmin'].includes(req.user.role)) {
      return res.sendStatus(401);
    }

    try {
      const stats = {
        totalUsers: 1247,
        activeUsers: 892,
        totalDocuments: 3456,
        totalRevenue: 12540000,
        monthlyGrowth: 15.4,
        systemHealth: 'good' as const
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting admin stats:', error);
      res.status(500).json({ error: 'Error getting admin statistics' });
    }
  });

  // Usuarios del sistema para admin
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !['admin', 'superadmin'].includes(req.user.role)) {
      return res.sendStatus(401);
    }

    try {
      const users = await storage.getUsersByRole('user');
      const allUsers = users.concat(await storage.getUsersByRole('certifier'));
      
      // Agregar información adicional simulada
      const enrichedUsers = allUsers.map(user => ({
        ...user,
        status: Math.random() > 0.1 ? 'active' : 'inactive',
        lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      res.json(enrichedUsers);
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ error: 'Error getting users' });
    }
  });

  // Alertas del sistema
  app.get("/api/admin/alerts", async (req, res) => {
    if (!req.isAuthenticated() || !['admin', 'superadmin'].includes(req.user.role)) {
      return res.sendStatus(401);
    }

    try {
      const alerts = [
        {
          id: 1,
          type: 'warning',
          message: 'Alto número de documentos pendientes de certificación',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          resolved: false
        },
        {
          id: 2,
          type: 'info',
          message: 'Actualización del sistema programada para mañana',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          resolved: false
        }
      ];
      
      res.json(alerts);
    } catch (error) {
      console.error('Error getting alerts:', error);
      res.status(500).json({ error: 'Error getting alerts' });
    }
  });

  // Acciones de usuario para admin
  app.post("/api/admin/users/:userId/:action", async (req, res) => {
    if (!req.isAuthenticated() || !['admin', 'superadmin'].includes(req.user.role)) {
      return res.sendStatus(401);
    }

    try {
      const { userId, action } = req.params;
      
      if (!['activate', 'suspend', 'delete'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }

      // Simular la acción
      const result = {
        success: true,
        userId: parseInt(userId),
        action: action,
        performedBy: req.user.id,
        timestamp: new Date().toISOString()
      };

      res.json(result);
    } catch (error) {
      console.error('Error performing user action:', error);
      res.status(500).json({ error: 'Error performing action' });
    }
  });
}