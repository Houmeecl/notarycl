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
import { ronManager } from "./modules/ron-manager";
import { identityVerificationManager } from "./modules/identity-verification";
import { securityManager } from "./modules/security-manager";
import { workflowEngine, createDocumentWithWorkflow } from "./modules/workflow-engine";
import crypto from "crypto";

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
    const { templateId, formData, workflowOptions = {} } = req.body;
    
    if (!templateId || !formData) {
      return res.status(400).json({ message: "templateId y formData son requeridos" });
    }

    // Crear documento con flujo de trabajo integrado
    const { document, workflowId } = createDocumentWithWorkflow(
      templateId, 
      req.user.id, 
      formData, 
      workflowOptions
    );
    
    res.status(201).json({
      message: "Documento y flujo de trabajo creados exitosamente",
      document,
      workflowId,
      workflow: workflowEngine.getWorkflow(workflowId)
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
// RUTAS RON (Remote Online Notarization)
// ================================

app.post("/api/ron/schedule", authenticateUser, (req: any, res) => {
  try {
    const { documentId, notaryId, scheduledAt, participants } = req.body;
    
    if (!documentId || !notaryId || !scheduledAt || !participants) {
      return res.status(400).json({ message: "Campos requeridos: documentId, notaryId, scheduledAt, participants" });
    }

    const sessionId = ronManager.scheduleRONSession(
      documentId,
      parseInt(notaryId),
      req.user.id,
      new Date(scheduledAt),
      participants
    );

    res.status(201).json({
      message: "Sesión RON programada exitosamente",
      sessionId,
      meetingInfo: ronManager.getRONSession(sessionId)
    });
  } catch (error) {
    console.error("Error programando sesión RON:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.get("/api/ron/sessions", authenticateUser, (req: any, res) => {
  try {
    const sessions = ronManager.getClientRONSessions(req.user.id);
    res.json(sessions);
  } catch (error) {
    console.error("Error obteniendo sesiones RON:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/ron/sessions/:id", authenticateUser, (req: any, res) => {
  try {
    const session = ronManager.getRONSession(req.params.id);
    
    if (!session) {
      return res.status(404).json({ message: "Sesión RON no encontrada" });
    }

    // Verificar acceso
    if (session.clientId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: "No tienes acceso a esta sesión" });
    }

    res.json(session);
  } catch (error) {
    console.error("Error obteniendo sesión RON:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/ron/sessions/:id/join", (req, res) => {
  try {
    const { participantId } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
    
    if (!participantId) {
      return res.status(400).json({ message: "participantId requerido" });
    }

    const result = ronManager.joinRONSession(req.params.id, participantId, clientIP);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    res.json({
      message: "Unido a sesión RON exitosamente",
      meetingInfo: result.meetingInfo
    });
  } catch (error) {
    console.error("Error uniéndose a sesión RON:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/ron/sessions/:id/status", authenticateUser, (req: any, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: "status requerido" });
    }

    const success = ronManager.updateSessionStatus(req.params.id, status, notes);
    
    if (!success) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    res.json({ message: "Estado de sesión actualizado" });
  } catch (error) {
    console.error("Error actualizando estado de sesión:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/ron/stats", authenticateUser, (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    const stats = ronManager.getRONStats();
    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo estadísticas RON:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE VERIFICACIÓN DE IDENTIDAD
// ================================

app.post("/api/identity/verify", authenticateUser, (req: any, res) => {
  try {
    const { purpose, requiredMethods } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    if (!purpose) {
      return res.status(400).json({ message: "purpose requerido" });
    }

    const methods = requiredMethods || identityVerificationManager.getRecommendedMethods(purpose);
    
    const sessionId = identityVerificationManager.createVerificationSession(
      req.user.id,
      purpose,
      methods,
      {
        ipAddress: clientIP,
        userAgent,
        deviceFingerprint: crypto.createHash('md5').update(userAgent + clientIP).digest('hex')
      }
    );

    res.status(201).json({
      message: "Sesión de verificación creada",
      sessionId,
      requiredMethods: methods,
      session: identityVerificationManager.getVerificationSession(sessionId)
    });
  } catch (error) {
    console.error("Error creando verificación:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.get("/api/identity/sessions/:id", authenticateUser, (req: any, res) => {
  try {
    const session = identityVerificationManager.getVerificationSession(req.params.id);
    
    if (!session) {
      return res.status(404).json({ message: "Sesión de verificación no encontrada" });
    }

    if (session.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: "No tienes acceso a esta sesión" });
    }

    res.json(session);
  } catch (error) {
    console.error("Error obteniendo sesión de verificación:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/identity/analyze-document", authenticateUser, (req: any, res) => {
  try {
    const { sessionId, methodId, documentType, frontImage, backImage } = req.body;
    
    if (!sessionId || !methodId || !documentType || !frontImage) {
      return res.status(400).json({ message: "Campos requeridos: sessionId, methodId, documentType, frontImage" });
    }

    const analysis = identityVerificationManager.analyzeDocument(
      sessionId,
      methodId,
      documentType,
      frontImage,
      backImage
    );

    res.json({
      message: "Documento analizado exitosamente",
      analysis
    });
  } catch (error) {
    console.error("Error analizando documento:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.post("/api/identity/biometric", authenticateUser, (req: any, res) => {
  try {
    const { sessionId, methodId, biometricType, biometricData, quality, deviceInfo } = req.body;
    
    if (!sessionId || !methodId || !biometricType || !biometricData) {
      return res.status(400).json({ message: "Campos requeridos: sessionId, methodId, biometricType, biometricData" });
    }

    const result = identityVerificationManager.performBiometricVerification(
      sessionId,
      methodId,
      {
        type: biometricType,
        data: biometricData,
        quality: quality || 80,
        deviceInfo: deviceInfo || 'Unknown'
      }
    );

    res.json({
      message: "Verificación biométrica completada",
      biometricData: result
    });
  } catch (error) {
    console.error("Error en verificación biométrica:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.post("/api/identity/liveness", authenticateUser, (req: any, res) => {
  try {
    const { sessionId, methodId, checkType, response } = req.body;
    
    if (!sessionId || !methodId || !checkType) {
      return res.status(400).json({ message: "Campos requeridos: sessionId, methodId, checkType" });
    }

    const livenessCheck = identityVerificationManager.performLivenessCheck(
      sessionId,
      methodId,
      checkType,
      response
    );

    res.json({
      message: "Detección de vida completada",
      livenessCheck
    });
  } catch (error) {
    console.error("Error en detección de vida:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.get("/api/identity/kba/:sessionId/:methodId", authenticateUser, (req: any, res) => {
  try {
    const { sessionId, methodId } = req.params;
    
    const questions = identityVerificationManager.generateKBAQuestions(sessionId, methodId);
    
    res.json({
      message: "Preguntas KBA generadas",
      questions: questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty
      })) // No enviar respuestas correctas
    });
  } catch (error) {
    console.error("Error generando preguntas KBA:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.post("/api/identity/kba/submit", authenticateUser, (req: any, res) => {
  try {
    const { sessionId, methodId, answers } = req.body;
    
    if (!sessionId || !methodId || !answers) {
      return res.status(400).json({ message: "Campos requeridos: sessionId, methodId, answers" });
    }

    const kbaResult = identityVerificationManager.submitKBAAnswers(sessionId, methodId, answers);
    
    res.json({
      message: "Respuestas KBA evaluadas",
      result: {
        score: kbaResult.score,
        status: kbaResult.status,
        correctAnswers: kbaResult.answers.filter(a => a.isCorrect).length,
        totalQuestions: kbaResult.questions.length
      }
    });
  } catch (error) {
    console.error("Error evaluando KBA:", error);
    res.status(500).json({ message: error.message || "Error interno del servidor" });
  }
});

app.get("/api/identity/stats", authenticateUser, (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    const stats = identityVerificationManager.getVerificationStats();
    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo estadísticas de verificación:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE FLUJO DE TRABAJO
// ================================

app.get("/api/workflows", authenticateUser, (req: any, res) => {
  try {
    const workflows = workflowEngine.getUserWorkflows(req.user.id);
    res.json(workflows);
  } catch (error) {
    console.error("Error obteniendo flujos de trabajo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/workflows/:id", authenticateUser, (req: any, res) => {
  try {
    const workflow = workflowEngine.getWorkflow(req.params.id);
    
    if (!workflow) {
      return res.status(404).json({ message: "Flujo de trabajo no encontrado" });
    }

    if (workflow.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: "No tienes acceso a este flujo" });
    }

    res.json(workflow);
  } catch (error) {
    console.error("Error obteniendo flujo de trabajo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/workflows/:id/advance", authenticateUser, (req: any, res) => {
  try {
    const { stepId, stepData } = req.body;
    
    if (!stepId) {
      return res.status(400).json({ message: "stepId requerido" });
    }

    const success = workflowEngine.advanceWorkflow(req.params.id, stepId, stepData);
    
    if (!success) {
      return res.status(400).json({ message: "No se pudo avanzar el flujo" });
    }

    res.json({
      message: "Flujo avanzado exitosamente",
      workflow: workflowEngine.getWorkflow(req.params.id)
    });
  } catch (error) {
    console.error("Error avanzando flujo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/workflows/:id/retry", authenticateUser, (req: any, res) => {
  try {
    const { stepId } = req.body;
    
    if (!stepId) {
      return res.status(400).json({ message: "stepId requerido" });
    }

    const success = workflowEngine.retryFailedStep(req.params.id, stepId);
    
    if (!success) {
      return res.status(400).json({ message: "No se pudo reintentar el paso" });
    }

    res.json({
      message: "Paso reintentado exitosamente",
      workflow: workflowEngine.getWorkflow(req.params.id)
    });
  } catch (error) {
    console.error("Error reintentando paso:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/workflows/:id/cancel", authenticateUser, (req: any, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: "reason requerido" });
    }

    const success = workflowEngine.cancelWorkflow(req.params.id, reason);
    
    if (!success) {
      return res.status(400).json({ message: "No se pudo cancelar el flujo" });
    }

    res.json({ message: "Flujo cancelado exitosamente" });
  } catch (error) {
    console.error("Error cancelando flujo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.get("/api/workflows/stats", authenticateUser, (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    const stats = workflowEngine.getWorkflowStats();
    const health = workflowEngine.getWorkflowHealth();
    
    res.json({
      stats,
      health
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas de flujo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// RUTAS DE SISTEMA
// ================================

app.get("/api/health", (req, res) => {
  const workflowHealth = workflowEngine.getWorkflowHealth();
  
  res.json({ 
    status: "ok", 
    message: "DocuSignPro Complete Business Logic System",
    timestamp: new Date().toISOString(),
    users: simpleStorage.getAllUsers().length,
    modules: {
      documents: documentManager.getDocumentStats().total,
      signatures: signatureManager.getSignatureStats().totalRequests,
      notaries: notaryManager.getAllActiveNotaries().length,
      payments: paymentManager.getPaymentStats().totalTransactions,
      ronSessions: ronManager.getRONStats().totalSessions,
      identityVerifications: identityVerificationManager.getVerificationStats().totalSessions,
      securityEvents: securityManager.getSecurityStats().totalEvents,
      activeWorkflows: workflowHealth.activeWorkflows,
      systemLoad: workflowHealth.systemLoad
    },
    systemHealth: {
      workflowEngine: workflowHealth,
      alerts: workflowHealth.alerts
    },
    version: "3.0.0-complete-business-logic"
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
    const ronStats = ronManager.getRONStats();
    const identityStats = identityVerificationManager.getVerificationStats();
    const workflowStats = workflowEngine.getWorkflowStats();
    const workflowHealth = workflowEngine.getWorkflowHealth();
    const securityStats = securityManager.getSecurityStats();

    res.json({
      overview: {
        totalUsers: simpleStorage.getAllUsers().length,
        totalDocuments: documentStats.total,
        totalNotarizations: notaryStats.totalNotarizations,
        totalRevenue: paymentStats.totalAmount,
        activeWorkflows: workflowStats.activeWorkflows,
        ronSessions: ronStats.totalSessions,
        securityAlerts: securityStats.criticalAlerts
      },
      documents: documentStats,
      signatures: signatureStats,
      notaries: notaryStats,
      payments: paymentStats,
      ron: ronStats,
      identity: identityStats,
      workflows: workflowStats,
      workflowHealth,
      security: securityStats
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

// Ruta para pruebas RON
app.get("/ron", (req, res) => {
  const ronPath = path.join(process.cwd(), "test-ron.html");
  res.sendFile(ronPath);
});

// Ruta para flujo de trabajo de documentos
app.get("/workflow/:documentId", (req, res) => {
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
       console.log("   🎥 RON (Remote Online Notarization):");
       console.log("      POST /api/ron/schedule - Programar sesión RON");
       console.log("      GET  /api/ron/sessions - Mis sesiones RON");
       console.log("      GET  /api/ron/sessions/:id - Detalle de sesión");
       console.log("      POST /api/ron/sessions/:id/join - Unirse a sesión");
       console.log("      POST /api/ron/sessions/:id/status - Actualizar estado");
       console.log("");
       console.log("   🆔 VERIFICACIÓN DE IDENTIDAD:");
       console.log("      POST /api/identity/verify - Iniciar verificación");
       console.log("      GET  /api/identity/sessions/:id - Estado de verificación");
       console.log("      POST /api/identity/analyze-document - Analizar documento");
       console.log("      POST /api/identity/biometric - Verificación biométrica");
       console.log("      POST /api/identity/liveness - Detección de vida");
       console.log("      GET  /api/identity/kba/:sessionId/:methodId - Preguntas KBA");
       console.log("      POST /api/identity/kba/submit - Enviar respuestas KBA");
       console.log("");
       console.log("   ⚙️ FLUJO DE TRABAJO:");
       console.log("      GET  /api/workflows - Mis flujos de trabajo");
       console.log("      GET  /api/workflows/:id - Detalle de flujo");
       console.log("      POST /api/workflows/:id/advance - Avanzar flujo");
       console.log("      POST /api/workflows/:id/retry - Reintentar paso");
       console.log("      POST /api/workflows/:id/cancel - Cancelar flujo");
       console.log("");
       console.log("   📊 SISTEMA:");
       console.log("      GET  /api/health - Estado del sistema");
       console.log("      GET  /api/stats/dashboard - Dashboard completo");
       console.log("      GET  /api/workflows/stats - Estadísticas de flujo");
      console.log("");
             console.log("🌐 Frontend: http://localhost:5000");
       console.log("🧪 Pruebas básicas: http://localhost:5000/test");
       console.log("🔬 Pruebas avanzadas: http://localhost:5000/enhanced");
       console.log("📊 Dashboard: http://localhost:5000/dashboard");
       console.log("🎥 Pruebas RON: http://localhost:5000/ron");
       console.log("✅ ¡Sistema completo con RON listo para desarrollo!");
    });
    
  } catch (error) {
    console.error("❌ Error iniciando servidor:", error);
    process.exit(1);
  }
}

startEnhancedServer();