import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import { simpleStorage, type SimpleUser } from "./simple-storage";
import { hashPassword, verifyPassword, generateRandomPassword } from "./simple-auth";
import { documentManager } from "./modules/document-manager";
import { signatureManager } from "./modules/signature-manager";
import { notaryManager } from "./modules/notary-manager";
import { paymentManager } from "./modules/payment-manager";

const app = express();

// Middleware básico
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS para desarrollo
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Logging middleware mejorado
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  const method = req.method;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    if (reqPath.startsWith("/api")) {
      const logLevel = status >= 400 ? "ERROR" : status >= 300 ? "WARN" : "INFO";
      console.log(`[${logLevel}] ${method} ${reqPath} ${status} in ${duration}ms - IP: ${ip}`);
      
      if (duration > 1000) {
        console.warn(`⚠️ Slow request: ${method} ${reqPath} took ${duration}ms`);
      }
    }
  });

  next();
});

// Middleware de autenticación simulado
const authenticateUser = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Token de autorización requerido" });
  }

  const token = authHeader.substring(7);
  
  // Simulación: decodificar userId del token
  try {
    const userId = parseInt(Buffer.from(token, 'base64').toString());
    const user = simpleStorage.findUserById(userId);
    
    if (!user) {
      return res.status(401).json({ message: "Usuario no válido" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido" });
  }
};

// Inicializar administrador
async function initializeAdmin() {
  const existingAdmin = simpleStorage.findUserByUsername("admin");
  
  if (existingAdmin) {
    console.log("✅ Administrador ya existe");
    return;
  }

  const adminPassword = generateRandomPassword(12);
  const hashedPassword = await hashPassword(adminPassword);
  
  const admin: SimpleUser = {
    id: Date.now(),
    username: "admin",
    password: hashedPassword,
    email: "admin@docusignpro.com",
    fullName: "Administrador Principal",
    role: "admin",
    platform: "notarypro",
    createdAt: new Date()
  };
  
  simpleStorage.addUser(admin);
  
  console.log("🎉 ADMINISTRADOR CREADO:");
  console.log(`   Usuario: admin`);
  console.log(`   Contraseña: ${adminPassword}`);
  console.log("⚠️  Guarda estas credenciales");
}

// ================================
// RUTAS DE AUTENTICACIÓN
// ================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Usuario y contraseña requeridos" });
    }

    const user = simpleStorage.findUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Generar token simple (en producción usar JWT)
    const token = Buffer.from(user.id.toString()).toString('base64');

    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        platform: user.platform
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, email, fullName, platform = "notarypro" } = req.body;
    
    if (!username || !password || !email || !fullName) {
      return res.status(400).json({ message: "Todos los campos son requeridos" });
    }

    if (simpleStorage.findUserByUsername(username)) {
      return res.status(409).json({ message: "El usuario ya existe" });
    }
    
    if (simpleStorage.findUserByEmail(email)) {
      return res.status(409).json({ message: "El email ya está registrado" });
    }

    const hashedPassword = await hashPassword(password);
    
    const newUser: SimpleUser = {
      id: Date.now(),
      username,
      password: hashedPassword,
      email,
      fullName,
      role: "user",
      platform,
      createdAt: new Date()
    };
    
    simpleStorage.addUser(newUser);
    
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        platform: newUser.platform
      }
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE DOCUMENTOS
// ================================

app.get("/api/documents/templates", (req, res) => {
  try {
    const { category } = req.query;
    
    let templates = documentManager.getAllTemplates();
    
    if (category) {
      templates = documentManager.getTemplatesByCategory(category as string);
    }
    
    res.json(templates);
  } catch (error) {
    console.error("Error obteniendo plantillas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/documents/templates/:id", (req, res) => {
  try {
    const template = documentManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ message: "Plantilla no encontrada" });
    }
    
    res.json(template);
  } catch (error) {
    console.error("Error obteniendo plantilla:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/documents", authenticateUser, (req: any, res) => {
  try {
    const { templateId, formData } = req.body;
    
    if (!templateId || !formData) {
      return res.status(400).json({ message: "templateId y formData son requeridos" });
    }

    const document = documentManager.createDocument(templateId, req.user.id, formData);
    
    res.status(201).json({
      message: "Documento creado exitosamente",
      document
    });
  } catch (error) {
    console.error("Error creando documento:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.get("/api/documents", authenticateUser, (req: any, res) => {
  try {
    const { status, search } = req.query;
    
    let documents = documentManager.getUserDocuments(req.user.id);
    
    if (status) {
      documents = documents.filter(d => d.status === status);
    }
    
    if (search) {
      documents = documentManager.searchDocuments(search as string, req.user.id);
    }
    
    res.json(documents);
  } catch (error) {
    console.error("Error obteniendo documentos:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/documents/:id", authenticateUser, (req: any, res) => {
  try {
    const document = documentManager.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    // Verificar que el usuario tiene acceso al documento
    if (document.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: "No tienes acceso a este documento" });
    }
    
    res.json(document);
  } catch (error) {
    console.error("Error obteniendo documento:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/documents/:id/html", authenticateUser, (req: any, res) => {
  try {
    const document = documentManager.getDocument(req.params.id);
    
    if (!document || (document.userId !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const html = documentManager.generateDocumentHtml(req.params.id);
    
    if (!html) {
      return res.status(500).json({ message: "Error generando HTML del documento" });
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error("Error generando HTML:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/documents/stats", authenticateUser, (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    const stats = documentManager.getDocumentStats();
    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE FIRMAS DIGITALES
// ================================

app.post("/api/signatures/request", authenticateUser, (req: any, res) => {
  try {
    const { documentId, signerEmail, signerName, message } = req.body;
    
    if (!documentId || !signerEmail || !signerName) {
      return res.status(400).json({ message: "Campos requeridos: documentId, signerEmail, signerName" });
    }

    const requestId = signatureManager.createSignatureRequest({
      documentId,
      signerEmail,
      signerName,
      requesterUserId: req.user.id,
      message
    });

    const signatureUrl = signatureManager.generateSignatureUrl(requestId);

    res.status(201).json({
      message: "Solicitud de firma creada exitosamente",
      requestId,
      signatureUrl: `${req.protocol}://${req.get('host')}${signatureUrl}`
    });
  } catch (error) {
    console.error("Error creando solicitud de firma:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/signatures/pending", authenticateUser, (req: any, res) => {
  try {
    const pendingRequests = signatureManager.getPendingRequestsForUser(req.user.email);
    res.json(pendingRequests);
  } catch (error) {
    console.error("Error obteniendo solicitudes pendientes:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/signatures/stats", authenticateUser, (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    const stats = signatureManager.getSignatureStats();
    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo estadísticas de firmas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE SERVICIOS NOTARIALES
// ================================

app.get("/api/notaries", (req, res) => {
  try {
    const { jurisdiction, specialization, availableRemotely, search } = req.query;
    
    let notaries = notaryManager.getAllActiveNotaries();
    
    if (search || jurisdiction || specialization || availableRemotely !== undefined) {
      notaries = notaryManager.searchNotaries(search as string || '', {
        jurisdiction: jurisdiction as string,
        specialization: specialization as string,
        availableRemotely: availableRemotely === 'true'
      });
    }
    
    // Agregar información del usuario
    const notariesWithUserInfo = notaries.map(notary => {
      const user = simpleStorage.findUserById(notary.userId);
      return {
        ...notary,
        userName: user?.fullName || 'Notario',
        userEmail: user?.email || ''
      };
    });
    
    res.json(notariesWithUserInfo);
  } catch (error) {
    console.error("Error obteniendo notarios:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/notaries/:id", (req, res) => {
  try {
    const notaryId = parseInt(req.params.id);
    const notary = notaryManager.getNotaryProfile(notaryId);
    
    if (!notary) {
      return res.status(404).json({ message: "Notario no encontrado" });
    }
    
    const user = simpleStorage.findUserById(notary.userId);
    const services = notaryManager.getNotaryServices(notaryId);
    const stats = notaryManager.getNotaryStats(notaryId);
    
    res.json({
      ...notary,
      userName: user?.fullName || 'Notario',
      userEmail: user?.email || '',
      services,
      stats
    });
  } catch (error) {
    console.error("Error obteniendo notario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/notaries/:id/availability", (req, res) => {
  try {
    const notaryId = parseInt(req.params.id);
    const { date } = req.query;
    
    if (!date) {
      const availability = notaryManager.getNotaryAvailability(notaryId);
      return res.json(availability);
    }
    
    const targetDate = new Date(date as string);
    const timeSlots = notaryManager.getAvailableTimeSlots(notaryId, targetDate);
    
    res.json({
      date: targetDate.toISOString().split('T')[0],
      availableSlots: timeSlots
    });
  } catch (error) {
    console.error("Error obteniendo disponibilidad:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/notaries/appointments", authenticateUser, (req: any, res) => {
  try {
    const { notaryId, serviceType, appointmentDate, duration, location, notes, feeEstimate } = req.body;
    
    if (!notaryId || !serviceType || !appointmentDate) {
      return res.status(400).json({ message: "Campos requeridos: notaryId, serviceType, appointmentDate" });
    }

    const appointmentId = notaryManager.scheduleAppointment({
      notaryId: parseInt(notaryId),
      clientId: req.user.id,
      serviceType,
      appointmentDate: new Date(appointmentDate),
      duration: duration || 60,
      location: location || 'office',
      notes,
      feeEstimate: feeEstimate || 0
    });

    res.status(201).json({
      message: "Cita programada exitosamente",
      appointmentId
    });
  } catch (error) {
    console.error("Error programando cita:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE PAGOS
// ================================

app.get("/api/payments/providers", (req, res) => {
  try {
    const { currency = "CLP" } = req.query;
    const providers = paymentManager.getAvailableProviders(currency as string);
    res.json(providers);
  } catch (error) {
    console.error("Error obteniendo proveedores:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/payments/calculate", (req, res) => {
  try {
    const { amount, providerId } = req.body;
    
    if (!amount || !providerId) {
      return res.status(400).json({ message: "amount y providerId son requeridos" });
    }

    const calculation = paymentManager.calculateTotalAmount(amount, providerId);
    res.json(calculation);
  } catch (error) {
    console.error("Error calculando pago:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.post("/api/payments/create", authenticateUser, (req: any, res) => {
  try {
    const { amount, currency = "CLP", description, metadata, providerId } = req.body;
    
    if (!amount || !description || !metadata || !providerId) {
      return res.status(400).json({ message: "Campos requeridos: amount, description, metadata, providerId" });
    }

    const paymentIntent = paymentManager.createPaymentIntent(
      req.user.id,
      amount,
      currency,
      description,
      metadata,
      providerId
    );

    res.status(201).json({
      message: "Intención de pago creada",
      paymentIntent
    });
  } catch (error) {
    console.error("Error creando pago:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.post("/api/payments/:id/process", (req, res) => {
  try {
    const { paymentMethod, providerPaymentId } = req.body;
    
    if (!paymentMethod || !providerPaymentId) {
      return res.status(400).json({ message: "paymentMethod y providerPaymentId son requeridos" });
    }

    const success = paymentManager.processPayment(req.params.id, paymentMethod, providerPaymentId);
    
    if (!success) {
      return res.status(404).json({ message: "Pago no encontrado o expirado" });
    }

    res.json({ message: "Pago en procesamiento" });
  } catch (error) {
    console.error("Error procesando pago:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/payments", authenticateUser, (req: any, res) => {
  try {
    const payments = paymentManager.getUserPayments(req.user.id);
    res.json(payments);
  } catch (error) {
    console.error("Error obteniendo pagos:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE SISTEMA
// ================================

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "DocuSignPro Enhanced Server",
    timestamp: new Date().toISOString(),
    users: simpleStorage.getAllUsers().length,
    modules: {
      documents: documentManager.getDocumentStats().total,
      signatures: signatureManager.getSignatureStats().totalRequests,
      notaries: notaryManager.getAllActiveNotaries().length,
      payments: paymentManager.getPaymentStats().totalTransactions
    },
    version: "2.0.0-enhanced"
  });
});

app.get("/api/stats/dashboard", authenticateUser, (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const documentStats = documentManager.getDocumentStats();
    const signatureStats = signatureManager.getSignatureStats();
    const notaryStats = notaryManager.getSystemStats();
    const paymentStats = paymentManager.getPaymentStats();

    res.json({
      overview: {
        totalUsers: simpleStorage.getAllUsers().length,
        totalDocuments: documentStats.total,
        totalNotarizations: notaryStats.totalNotarizations,
        totalRevenue: paymentStats.totalAmount
      },
      documents: documentStats,
      signatures: signatureStats,
      notaries: notaryStats,
      payments: paymentStats
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas del dashboard:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS ESTÁTICAS Y SPA
// ================================

// Servir archivos estáticos del frontend
app.use(express.static(path.join(process.cwd(), "dist/public")));

// Ruta para página de pruebas
app.get("/test", (req, res) => {
  const testPath = path.join(process.cwd(), "test-frontend.html");
  res.sendFile(testPath);
});

// Ruta para página de pruebas avanzada
app.get("/enhanced", (req, res) => {
  const testPath = path.join(process.cwd(), "test-enhanced.html");
  res.sendFile(testPath);
});

// Ruta para dashboard de usuario
app.get("/dashboard", (req, res) => {
  const dashboardPath = path.join(process.cwd(), "dashboard.html");
  res.sendFile(dashboardPath);
});

// Catch-all para SPA
app.get("*", (req, res) => {
  const indexPath = path.join(process.cwd(), "dist/public/index.html");
  res.sendFile(indexPath);
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Error:", err);
  res.status(status).json({ message });
});

async function startEnhancedServer() {
  try {
    console.log("🚀 Iniciando DocuSignPro Enhanced Server...");
    
    // Inicializar administrador
    await initializeAdmin();
    
    const server = createServer(app);
    const port = 5000;
    
    server.listen(port, "0.0.0.0", () => {
      console.log("");
      console.log("🎉 ¡DOCUSIGNPRO ENHANCED FUNCIONANDO!");
      console.log(`📡 URL: http://localhost:${port}`);
      console.log(`👤 Usuarios: ${simpleStorage.getAllUsers().length}`);
      console.log("");
      console.log("📋 API Endpoints Completos:");
      console.log("   🔐 AUTH:");
      console.log("      POST /api/auth/login - Autenticación");
      console.log("      POST /api/auth/register - Registro");
      console.log("");
      console.log("   📄 DOCUMENTOS:");
      console.log("      GET  /api/documents/templates - Plantillas disponibles");
      console.log("      GET  /api/documents/templates/:id - Detalle de plantilla");
      console.log("      POST /api/documents - Crear documento");
      console.log("      GET  /api/documents - Mis documentos");
      console.log("      GET  /api/documents/:id - Detalle de documento");
      console.log("      GET  /api/documents/:id/html - HTML generado");
      console.log("");
      console.log("   ✍️ FIRMAS:");
      console.log("      POST /api/signatures/request - Solicitar firma");
      console.log("      GET  /api/signatures/pending - Firmas pendientes");
      console.log("");
      console.log("   ⚖️ NOTARIOS:");
      console.log("      GET  /api/notaries - Lista de notarios");
      console.log("      GET  /api/notaries/:id - Perfil de notario");
      console.log("      GET  /api/notaries/:id/availability - Disponibilidad");
      console.log("      POST /api/notaries/appointments - Programar cita");
      console.log("");
      console.log("   💳 PAGOS:");
      console.log("      GET  /api/payments/providers - Proveedores de pago");
      console.log("      POST /api/payments/calculate - Calcular total");
      console.log("      POST /api/payments/create - Crear pago");
      console.log("      GET  /api/payments - Mis pagos");
      console.log("");
      console.log("   📊 SISTEMA:");
      console.log("      GET  /api/health - Estado del sistema");
      console.log("      GET  /api/stats/dashboard - Dashboard admin");
      console.log("");
      console.log("🌐 Frontend: http://localhost:5000");
      console.log("🧪 Página de pruebas: http://localhost:5000/test");
      console.log("✅ ¡Sistema completo listo para desarrollo!");
    });
    
  } catch (error) {
    console.error("❌ Error iniciando servidor:", error);
    process.exit(1);
  }
}

startEnhancedServer();