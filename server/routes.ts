import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import vecinosRoutes from "./vecinos/vecinos-routes";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { documentForensicsRouter } from "./document-forensics-routes";
import { identityVerificationRouter } from "./identity-verification-routes";
import { contractRouter } from "./contract-routes";
import { mercadoPagoRouter } from "./mercadopago-routes";
import { ronRouter } from "./ron-routes";
import { tuuPaymentRouter } from "./tuu-payment-routes";
import { documentManagementRouter } from "./document-management-routes";
import { notaryDocumentRouter } from "./notary-document-routes";
import { posManagementRouter } from "./pos-management-routes";
import { registerDashboardRoutes } from "./routes/dashboard-routes";

export function registerRoutes(app: Express): Server {
  // Configuración de autenticación para la aplicación principal
  setupAuth(app);
  
  // Rutas para dashboards por rol
  registerDashboardRoutes(app);

  // Rutas específicas para Vecinos
  app.use("/api/vecinos", vecinosRoutes);

  // Rutas para análisis forense de documentos
  app.use("/api/document-forensics", documentForensicsRouter);

  // Rutas para verificación de identidad
  app.use("/api/identity", identityVerificationRouter);
  
  // Rutas para gestión de contratos
  app.use("/api/contracts", contractRouter);
  
  // Rutas para pagos con MercadoPago
  app.use("/api/payments", mercadoPagoRouter);
  
  // Rutas para plataforma RON
  app.use("/api/ron", ronRouter);
  
  // Rutas para pagos con Tuu Payments (POS)
  app.use("/api/tuu-payment", tuuPaymentRouter);
  
  // Sistema de Gestión Documental Unificado
  app.use("/api/document-management", documentManagementRouter);
  
  // Sistema de Documentos Notariales
  app.use("/api/notary-documents", notaryDocumentRouter);
  
  // Sistema de Gestión de Dispositivos POS
  app.use("/api/pos-management", posManagementRouter);
  
  // Ruta para servir archivos estáticos (documentos y contratos)
  app.use("/docs", express.static(path.join(process.cwd(), "docs")));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Inicializar admins de prueba si no existen
  initializeTestAdmins().catch(error => {
    console.error("Error inicializando admins de prueba:", error);
  });

  // Crea el servidor HTTP
  const httpServer = createServer(app);

  // Configura WebSocket en una ruta específica
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Nueva conexión WebSocket establecida');

    // Manejar mensajes recibidos
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Mensaje recibido:', data);

        // Responder con un eco
        ws.send(JSON.stringify({
          type: 'echo',
          data: data,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Error al procesar mensaje WebSocket:', error);
      }
    });

    // Manejar cierre de conexión
    ws.on('close', () => {
      console.log('Conexión WebSocket cerrada');
    });

    // Manejar errores
    ws.on('error', (error) => {
      console.error('Error en conexión WebSocket:', error);
    });

    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Conexión establecida con el servidor de NotaryPro',
      timestamp: new Date().toISOString()
    }));
  });

  return httpServer;
}

// Función para inicializar admins de prueba
async function initializeTestAdmins() {
  try {
    console.log("Inicializando administradores de prueba...");
    
    // Admin principal (Edward)
    let existingEdwardAdmin = storage.users.find(u => u.username === "Edwardadmin");

    if (existingEdwardAdmin) {
      console.log("El administrador Edwardadmin ya existe. Actualizando contraseña...");
      // Hash la contraseña usando la función del módulo de autenticación
      const hashedPassword = await hashPassword("adminq");
      // Actualizar en MemStorage
      existingEdwardAdmin.password = hashedPassword;
      console.log("Contraseña del administrador Edwardadmin actualizada.");
    } else {
      const hashedPassword = await hashPassword("adminq");
      storage.users.push({
        id: Date.now(),
        username: "Edwardadmin",
        password: hashedPassword,
        email: "admin@notarypro.cl",
        fullName: "Admin Principal",
        role: "admin",
        createdAt: new Date(),
        region: null,
        address: null,
        platform: null,
        businessName: null,
        comuna: null
      });
      console.log("Super admin inicializado correctamente");
    }

    // Admin secundario (Seba)
    const existingSebAdmin = storage.users.find(u => u.username === "Sebadmin");

    if (existingSebAdmin) {
      console.log("El administrador Sebadmin ya existe. Actualizando contraseña...");
      const hashedPassword = await hashPassword("admin123");
      existingSebAdmin.password = hashedPassword;
      console.log("Contraseña del administrador Sebadmin actualizada.");
    } else {
      const hashedPassword = await hashPassword("admin123");
      storage.users.push({
        id: Date.now() + 1,
        username: "Sebadmin",
        password: hashedPassword,
        email: "sebadmin@notarypro.cl",
        fullName: "Admin Secundario",
        role: "admin",
        createdAt: new Date(),
        region: null,
        address: null,
        platform: null,
        businessName: null,
        comuna: null
      });
      console.log("Admin Sebadmin inicializado correctamente");
    }

    // Admin NFC (para pruebas de NFC)
    const existingNfcAdmin = storage.users.find(u => u.username === "nfcadmin");

    if (!existingNfcAdmin) {
      const hashedPassword = await hashPassword("nfc123");
      storage.users.push({
        id: Date.now() + 2,
        username: "nfcadmin",
        password: hashedPassword,
        email: "nfc@notarypro.cl",
        fullName: "Admin NFC",
        role: "admin",
        createdAt: new Date(),
        region: null,
        address: null,
        platform: null,
        businessName: null,
        comuna: null
      });
      console.log("Admin NFC inicializado correctamente");
    }

    // Admin para VecinoXpress
    const existingVecinosAdmin = storage.users.find(u => u.username === "vecinosadmin");

    if (existingVecinosAdmin) {
      console.log("El administrador vecinosadmin ya existe. Actualizando contraseña...");
      const hashedPassword = await hashPassword("vecinos123");
      existingVecinosAdmin.password = hashedPassword;
      existingVecinosAdmin.platform = "vecinos";
      console.log("Contraseña del administrador vecinosadmin actualizada.");
    } else {
      const hashedPassword = await hashPassword("vecinos123");
      storage.users.push({
        id: Date.now() + 3,
        username: "vecinosadmin",
        password: hashedPassword,
        email: "admin@vecinoxpress.cl",
        fullName: "Admin VecinoXpress",
        role: "admin",
        platform: "vecinos",
        createdAt: new Date(),
        region: null,
        address: null,
        businessName: null,
        comuna: null
      });
      console.log("Admin VecinoXpress inicializado correctamente");
    }
    
    // Admin Mi Admin
    const existingMiAdmin = storage.users.find(u => u.username === "miadmin");

    if (!existingMiAdmin) {
      const hashedPassword = await hashPassword("miadmin123");
      storage.users.push({
        id: Date.now() + 4,
        username: "miadmin",
        password: hashedPassword,
        email: "miadmin@notarypro.cl",
        fullName: "Mi Admin",
        role: "admin",
        createdAt: new Date(),
        region: null,
        address: null,
        platform: null,
        businessName: null,
        comuna: null
      });
      console.log("Mi Admin inicializado correctamente");
    }

    // Usuario demo para VecinoXpress
    const existingDemoPartner = storage.users.find(u => u.username === "demopartner");

    if (!existingDemoPartner) {
      const hashedPassword = await hashPassword("password123");
      storage.users.push({
        id: Date.now() + 5,
        username: "demopartner",
        password: hashedPassword,
        email: "demo@vecinoxpress.cl",
        fullName: "Partner Demo",
        role: "partner",
        platform: "vecinos",
        createdAt: new Date(),
        region: null,
        address: null,
        businessName: null,
        comuna: null
      });
      console.log("Demo partner inicializado correctamente");
    }

    // Partners de prueba
    const partners = [
      { username: "partner1", password: "partner123", businessName: "Almacén Don Pedro" },
      { username: "partner2", password: "partner456", businessName: "Farmacia San José" },
      { username: "partner3", password: "partner789", businessName: "Librería Central" },
      { username: "partner4", password: "partner789", businessName: "Café Internet Express" }
    ];

    for (let i = 0; i < partners.length; i++) {
      const partner = partners[i];
      const existingPartner = storage.users.find(u => u.username === partner.username);
      
      if (!existingPartner) {
        const hashedPassword = await hashPassword(partner.password);
        storage.users.push({
          id: Date.now() + 10 + i,
          username: partner.username,
          password: hashedPassword,
          email: `${partner.username}@vecinoxpress.cl`,
          fullName: `Partner ${i + 1}`,
          role: "partner",
          platform: "vecinos",
          businessName: partner.businessName,
          createdAt: new Date(),
          region: null,
          address: null,
          comuna: null
        });
        console.log(`Partner ${partner.username} inicializado correctamente`);
      }
    }

    console.log("✅ Todos los administradores de prueba han sido inicializados correctamente");
    console.log("📋 Credenciales disponibles:");
    console.log("   - Edwardadmin / adminq");
    console.log("   - Sebadmin / admin123");
    console.log("   - nfcadmin / nfc123");
    console.log("   - vecinosadmin / vecinos123");
    console.log("   - miadmin / miadmin123");
    console.log("   - demopartner / password123");
    console.log("   - partner1 / partner123");
    console.log("   - partner2 / partner456");
    console.log("   - partner3 / partner789");
    console.log("   - partner4 / partner789");
  } catch (error) {
    console.error("❌ Error inicializando administradores:", error);
  }
}