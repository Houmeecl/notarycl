import { simpleStorage, type SimpleUser } from "./simple-storage";
import { hashPassword } from "./simple-auth";
import { documentManager } from "./modules/document-manager";
import { signatureManager } from "./modules/signature-manager";
import { notaryManager } from "./modules/notary-manager";
import { paymentManager } from "./modules/payment-manager";
import { ronManager } from "./modules/ron-manager";
import { identityVerificationManager } from "./modules/identity-verification";
import { workflowEngine, createDocumentWithWorkflow } from "./modules/workflow-engine";

export class DemoDataManager {
  private demoUsers: SimpleUser[] = [];
  private demoDocuments: any[] = [];
  private demoWorkflows: any[] = [];

  constructor() {
    console.log("🎬 Gestor de Datos de Demo inicializado");
  }

  async initializeDemoData(): Promise<void> {
    console.log("🎭 Inicializando datos de demostración...");
    
    await this.createDemoUsers();
    await this.createDemoDocuments();
    await this.createDemoRONSessions();
    await this.createDemoPayments();
    await this.createDemoVerifications();
    
    console.log("✅ Datos de demostración inicializados");
  }

  private async createDemoUsers(): Promise<void> {
    const demoUsers = [
      {
        username: "admin_demo",
        password: "Demo123!",
        email: "admin@docusignpro-demo.com",
        fullName: "María Elena Rodríguez",
        role: "admin",
        platform: "notarypro"
      },
      {
        username: "notario_demo",
        password: "Notario123!",
        email: "notario@docusignpro-demo.com",
        fullName: "Dr. Carlos Alberto Fuentes",
        role: "notary",
        platform: "notarypro"
      },
      {
        username: "cliente_demo",
        password: "Cliente123!",
        email: "cliente@docusignpro-demo.com",
        fullName: "Ana Patricia Silva",
        role: "user",
        platform: "notarypro"
      },
      {
        username: "empresa_demo",
        password: "Empresa123!",
        email: "contacto@empresademo.cl",
        fullName: "Roberto Empresario Pérez",
        role: "user",
        platform: "notarypro"
      },
      {
        username: "testigo_demo",
        password: "Testigo123!",
        email: "testigo@docusignpro-demo.com",
        fullName: "Luis Fernando Morales",
        role: "user",
        platform: "notarypro"
      }
    ];

    for (const userData of demoUsers) {
      const hashedPassword = await hashPassword(userData.password);
      
      const user: SimpleUser = {
        id: Date.now() + Math.random(),
        username: userData.username,
        password: hashedPassword,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        platform: userData.platform,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
      };

      simpleStorage.addUser(user);
      this.demoUsers.push(user);
    }

    console.log(`👥 ${this.demoUsers.length} usuarios de demo creados`);
  }

  private async createDemoDocuments(): Promise<void> {
    const cliente = this.demoUsers.find(u => u.username === "cliente_demo");
    const empresa = this.demoUsers.find(u => u.username === "empresa_demo");
    
    if (!cliente || !empresa) return;

    // Documento 1: Contrato de Arrendamiento (Completado)
    const { document: doc1, workflowId: wf1 } = createDocumentWithWorkflow(
      "rental_contract",
      cliente.id,
      {
        landlordName: "Inmobiliaria Los Robles S.A.",
        landlordRut: "76.123.456-7",
        tenantName: cliente.fullName,
        tenantRut: "12.345.678-9",
        propertyAddress: "Av. Providencia 1234, Depto 567, Providencia, Santiago",
        monthlyRent: "850000",
        contractStart: "2024-01-15",
        contractDuration: "12"
      },
      { workflowType: "standard" }
    );

    // Simular que está completado
    documentManager.updateDocumentStatus(doc1.id, "completed");
    
    // Agregar firma simulada
    documentManager.addDigitalSignature(doc1.id, {
      signerName: cliente.fullName,
      signerEmail: cliente.email,
      signatureData: this.generateMockSignature(),
      ipAddress: "192.168.1.100"
    });

    // Documento 2: Poder Notarial (En proceso RON)
    const { document: doc2, workflowId: wf2 } = createDocumentWithWorkflow(
      "power_of_attorney",
      empresa.id,
      {
        grantorName: empresa.fullName,
        grantorRut: "11.222.333-4",
        attorneyName: "Abogado Juan Carlos Pérez",
        attorneyRut: "22.333.444-5",
        powerScope: "Específico para Bienes Raíces",
        specificPowers: "Compra, venta y administración de propiedades inmobiliarias en la Región Metropolitana"
      },
      { workflowType: "ron", isUrgent: false }
    );

    // Documento 3: Contrato Express (Urgente)
    const { document: doc3, workflowId: wf3 } = createDocumentWithWorkflow(
      "rental_contract",
      empresa.id,
      {
        landlordName: empresa.fullName,
        landlordRut: "11.222.333-4",
        tenantName: "Startup Innovadora SpA",
        tenantRut: "77.888.999-0",
        propertyAddress: "Torre Costanera, Piso 45, Oficina 4501, Las Condes, Santiago",
        monthlyRent: "2500000",
        contractStart: new Date().toISOString().split('T')[0],
        contractDuration: "24"
      },
      { workflowType: "express", isUrgent: true }
    );

    this.demoDocuments = [doc1, doc2, doc3];
    console.log(`📄 ${this.demoDocuments.length} documentos de demo creados`);
  }

  private async createDemoRONSessions(): Promise<void> {
    const notario = this.demoUsers.find(u => u.username === "notario_demo");
    const cliente = this.demoUsers.find(u => u.username === "cliente_demo");
    const testigo = this.demoUsers.find(u => u.username === "testigo_demo");
    
    if (!notario || !cliente || !testigo) return;

    // Crear sesión RON de demostración
    const ronSessionId = ronManager.scheduleRONSession(
      this.demoDocuments[1]?.id || "demo_doc_2",
      1, // Notario ID
      cliente.id,
      new Date(Date.now() + 2 * 60 * 60 * 1000), // En 2 horas
      [
        {
          name: cliente.fullName,
          email: cliente.email,
          role: "client",
          ipAddress: "192.168.1.100",
          deviceInfo: "Chrome 120.0 on macOS"
        },
        {
          name: testigo.fullName,
          email: testigo.email,
          role: "witness",
          ipAddress: "192.168.1.101",
          deviceInfo: "Safari 17.0 on iPhone"
        }
      ]
    );

    // Simular sesión en progreso
    ronManager.startRONSession(ronSessionId, "192.168.1.100", "Chrome 120.0 on macOS");
    ronManager.updateSessionStatus(ronSessionId, "identity_verification");

    console.log(`🎥 Sesión RON de demo creada: ${ronSessionId}`);
  }

  private async createDemoPayments(): Promise<void> {
    const cliente = this.demoUsers.find(u => u.username === "cliente_demo");
    const empresa = this.demoUsers.find(u => u.username === "empresa_demo");
    
    if (!cliente || !empresa) return;

    // Pago completado
    const payment1 = paymentManager.createPaymentIntent(
      cliente.id,
      15000,
      "CLP",
      "Contrato de Arrendamiento",
      { documentId: this.demoDocuments[0]?.id, type: "document" },
      "mercadopago"
    );
    paymentManager.completePayment(payment1.id, "txn_demo_123456");

    // Pago RON en proceso
    const payment2 = paymentManager.createPaymentIntent(
      empresa.id,
      45000,
      "CLP",
      "Poder Notarial (RON)",
      { documentId: this.demoDocuments[1]?.id, type: "document" },
      "stripe"
    );

    // Pago express completado
    const payment3 = paymentManager.createPaymentIntent(
      empresa.id,
      25000,
      "CLP",
      "Contrato Express",
      { documentId: this.demoDocuments[2]?.id, type: "document" },
      "webpay"
    );
    paymentManager.completePayment(payment3.id, "txn_demo_789012");

    console.log("💳 Pagos de demo creados");
  }

  private async createDemoVerifications(): Promise<void> {
    const cliente = this.demoUsers.find(u => u.username === "cliente_demo");
    
    if (!cliente) return;

    // Verificación completada exitosamente
    const verificationSession = identityVerificationManager.createVerificationSession(
      cliente.id,
      "document_signing",
      ["document_analysis", "liveness_check"],
      {
        ipAddress: "192.168.1.100",
        userAgent: "Chrome/120.0.0.0",
        deviceFingerprint: "demo_device_123"
      }
    );

    // Simular verificación completada
    const session = identityVerificationManager.getVerificationSession(verificationSession);
    if (session) {
      session.status = "completed";
      session.overallScore = 95;
      session.riskLevel = "low";
      session.completedAt = new Date();
    }

    console.log("🆔 Verificaciones de demo creadas");
  }

  private generateMockSignature(): string {
    // Generar firma base64 simulada
    const canvas = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    return canvas.split(',')[1];
  }

  // Métodos para obtener datos de demo
  public getDemoUsers(): SimpleUser[] {
    return this.demoUsers;
  }

  public getDemoDocuments(): any[] {
    return this.demoDocuments;
  }

  public getDemoStats(): {
    users: number;
    documents: number;
    completedDocuments: number;
    ronSessions: number;
    totalRevenue: number;
    verificationRate: number;
  } {
    return {
      users: this.demoUsers.length,
      documents: this.demoDocuments.length,
      completedDocuments: 2,
      ronSessions: 1,
      totalRevenue: 85000,
      verificationRate: 98.5
    };
  }

  // Simular actividad en tiempo real
  public simulateRealTimeActivity(): void {
    setInterval(() => {
      this.simulateRandomActivity();
    }, 30000); // Cada 30 segundos
  }

  private simulateRandomActivity(): void {
    const activities = [
      () => this.simulateDocumentCreation(),
      () => this.simulatePaymentCompletion(),
      () => this.simulateSignatureRequest(),
      () => this.simulateRONActivity(),
      () => this.simulateVerificationCompletion()
    ];

    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    randomActivity();
  }

  private simulateDocumentCreation(): void {
    console.log("🎭 [DEMO] Nuevo documento creado por cliente demo");
  }

  private simulatePaymentCompletion(): void {
    console.log("🎭 [DEMO] Pago completado en sistema demo");
  }

  private simulateSignatureRequest(): void {
    console.log("🎭 [DEMO] Solicitud de firma enviada");
  }

  private simulateRONActivity(): void {
    console.log("🎭 [DEMO] Actividad RON: participante se unió a sesión");
  }

  private simulateVerificationCompletion(): void {
    console.log("🎭 [DEMO] Verificación de identidad completada con score 94%");
  }

  // Crear escenarios específicos para demo
  public async createDemoScenario(scenarioType: 'standard' | 'ron' | 'enterprise'): Promise<{
    users: SimpleUser[];
    documents: any[];
    workflows: any[];
    message: string;
  }> {
    switch (scenarioType) {
      case 'standard':
        return this.createStandardDemoScenario();
      case 'ron':
        return this.createRONDemoScenario();
      case 'enterprise':
        return this.createEnterpriseDemoScenario();
      default:
        throw new Error("Tipo de escenario no válido");
    }
  }

  private async createStandardDemoScenario(): Promise<any> {
    const cliente = this.demoUsers.find(u => u.username === "cliente_demo");
    if (!cliente) throw new Error("Usuario demo no encontrado");

    // Crear documento con flujo estándar
    const { document, workflowId } = createDocumentWithWorkflow(
      "rental_contract",
      cliente.id,
      {
        landlordName: "Inmobiliaria Premium S.A.",
        landlordRut: "76.555.666-7",
        tenantName: cliente.fullName,
        tenantRut: "12.345.678-9",
        propertyAddress: "Av. Las Condes 12345, Torre A, Piso 25, Las Condes, Santiago",
        monthlyRent: "1200000",
        contractStart: new Date().toISOString().split('T')[0],
        contractDuration: "18"
      },
      { workflowType: "standard" }
    );

    return {
      users: [cliente],
      documents: [document],
      workflows: [workflowEngine.getWorkflow(workflowId)],
      message: "Escenario estándar: Contrato de arrendamiento premium con flujo tradicional"
    };
  }

  private async createRONDemoScenario(): Promise<any> {
    const empresa = this.demoUsers.find(u => u.username === "empresa_demo");
    const testigo = this.demoUsers.find(u => u.username === "testigo_demo");
    
    if (!empresa || !testigo) throw new Error("Usuarios demo no encontrados");

    // Crear poder notarial con RON
    const { document, workflowId } = createDocumentWithWorkflow(
      "power_of_attorney",
      empresa.id,
      {
        grantorName: empresa.fullName,
        grantorRut: "11.222.333-4",
        attorneyName: "Estudio Jurídico Internacional Ltda.",
        attorneyRut: "77.999.888-1",
        powerScope: "General",
        specificPowers: "Representación completa para operaciones comerciales internacionales, incluyendo firma de contratos, apertura de cuentas bancarias, y gestión de inversiones en el extranjero."
      },
      { workflowType: "ron", requiresRON: true }
    );

    // Programar sesión RON
    const ronSessionId = ronManager.scheduleRONSession(
      document.id,
      1,
      empresa.id,
      new Date(Date.now() + 60 * 60 * 1000), // En 1 hora
      [
        {
          name: empresa.fullName,
          email: empresa.email,
          role: "client",
          ipAddress: "192.168.1.200",
          deviceInfo: "Chrome 120.0 on Windows 11"
        },
        {
          name: testigo.fullName,
          email: testigo.email,
          role: "witness",
          ipAddress: "192.168.1.201",
          deviceInfo: "Safari 17.0 on macOS"
        }
      ]
    );

    return {
      users: [empresa, testigo],
      documents: [document],
      workflows: [workflowEngine.getWorkflow(workflowId)],
      ronSession: ronManager.getRONSession(ronSessionId),
      message: "Escenario RON: Poder notarial internacional con notarización remota"
    };
  }

  private async createEnterpriseDemoScenario(): Promise<any> {
    // Crear múltiples documentos para mostrar volumen empresarial
    const empresa = this.demoUsers.find(u => u.username === "empresa_demo");
    if (!empresa) throw new Error("Usuario empresa no encontrado");

    const documents = [];
    const workflows = [];

    // Crear 5 documentos diferentes
    for (let i = 0; i < 5; i++) {
      const templateId = i % 2 === 0 ? "rental_contract" : "power_of_attorney";
      const workflowType = i % 3 === 0 ? "ron" : "standard";
      
      const { document, workflowId } = createDocumentWithWorkflow(
        templateId,
        empresa.id,
        this.generateRandomFormData(templateId, i),
        { 
          workflowType: workflowType as any,
          isUrgent: i === 0
        }
      );

      documents.push(document);
      workflows.push(workflowEngine.getWorkflow(workflowId));
    }

    return {
      users: [empresa],
      documents,
      workflows,
      message: "Escenario empresarial: Múltiples documentos con diferentes flujos y prioridades"
    };
  }

  private generateRandomFormData(templateId: string, index: number): any {
    if (templateId === "rental_contract") {
      return {
        landlordName: `Inmobiliaria Demo ${index + 1} S.A.`,
        landlordRut: `76.${(100 + index).toString().padStart(3, '0')}.${(200 + index).toString().padStart(3, '0')}-${index % 10}`,
        tenantName: `Cliente Empresarial ${index + 1}`,
        tenantRut: `12.${(300 + index).toString().padStart(3, '0')}.${(400 + index).toString().padStart(3, '0')}-${(index + 1) % 10}`,
        propertyAddress: `Av. Demo ${index + 1}, Oficina ${(index + 1) * 100}, Comuna Demo, Santiago`,
        monthlyRent: ((index + 1) * 500000).toString(),
        contractStart: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        contractDuration: (12 + index * 6).toString()
      };
    } else {
      return {
        grantorName: `Otorgante Demo ${index + 1}`,
        grantorRut: `11.${(500 + index).toString().padStart(3, '0')}.${(600 + index).toString().padStart(3, '0')}-${index % 10}`,
        attorneyName: `Apoderado Demo ${index + 1}`,
        attorneyRut: `22.${(700 + index).toString().padStart(3, '0')}.${(800 + index).toString().padStart(3, '0')}-${(index + 1) % 10}`,
        powerScope: index % 2 === 0 ? "General" : "Específico para Bienes Raíces",
        specificPowers: `Poderes específicos para caso demo ${index + 1}`
      };
    }
  }

  // Métodos para demo en vivo
  public async simulateCompleteWorkflow(documentId: string): Promise<void> {
    console.log(`🎭 [DEMO] Simulando flujo completo para documento ${documentId}`);
    
    const workflow = workflowEngine.getWorkflowByDocument(documentId);
    if (!workflow) return;

    // Simular cada paso del flujo con delays realistas
    for (const step of workflow.steps) {
      if (step.status === 'pending') {
        console.log(`🎭 [DEMO] Ejecutando paso: ${step.name}`);
        
        // Simular tiempo de procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Avanzar el flujo
        workflowEngine.advanceWorkflow(workflow.id, step.id, {
          demoMode: true,
          simulatedAt: new Date()
        });
        
        console.log(`🎭 [DEMO] Paso completado: ${step.name}`);
        break; // Solo avanzar un paso por llamada
      }
    }
  }

  public getDemoMetrics(): {
    realTime: {
      activeUsers: number;
      documentsInProgress: number;
      completedToday: number;
      revenueToday: number;
    };
    performance: {
      averageProcessingTime: number;
      successRate: number;
      customerSatisfaction: number;
      systemUptime: number;
    };
    growth: {
      monthlyGrowth: number;
      newClientsThisMonth: number;
      documentsThisMonth: number;
      revenueGrowth: number;
    };
  } {
    return {
      realTime: {
        activeUsers: Math.floor(Math.random() * 15) + 5, // 5-20
        documentsInProgress: Math.floor(Math.random() * 8) + 2, // 2-10
        completedToday: Math.floor(Math.random() * 25) + 15, // 15-40
        revenueToday: Math.floor(Math.random() * 500000) + 300000 // 300k-800k CLP
      },
      performance: {
        averageProcessingTime: Math.floor(Math.random() * 30) + 45, // 45-75 min
        successRate: Math.floor(Math.random() * 5) + 95, // 95-100%
        customerSatisfaction: Math.floor(Math.random() * 10) + 90, // 90-100%
        systemUptime: 99.9
      },
      growth: {
        monthlyGrowth: Math.floor(Math.random() * 20) + 15, // 15-35%
        newClientsThisMonth: Math.floor(Math.random() * 50) + 75, // 75-125
        documentsThisMonth: Math.floor(Math.random() * 200) + 300, // 300-500
        revenueGrowth: Math.floor(Math.random() * 25) + 20 // 20-45%
      }
    };
  }

  // Crear eventos de demo en tiempo real
  public createLiveEvent(eventType: string): {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: Date;
    user?: string;
    importance: 'low' | 'medium' | 'high';
  } {
    const events = {
      document_created: {
        title: "Nuevo Documento Creado",
        description: "Contrato de servicios profesionales iniciado",
        importance: 'medium' as const
      },
      payment_completed: {
        title: "Pago Procesado",
        description: "$35,000 CLP procesado vía MercadoPago",
        importance: 'high' as const
      },
      ron_session_started: {
        title: "Sesión RON Iniciada",
        description: "Notarización remota en progreso con 3 participantes",
        importance: 'high' as const
      },
      identity_verified: {
        title: "Identidad Verificada",
        description: "Verificación biométrica completada (Score: 96%)",
        importance: 'medium' as const
      },
      document_signed: {
        title: "Documento Firmado",
        description: "Firma digital aplicada exitosamente",
        importance: 'medium' as const
      },
      notarization_completed: {
        title: "Notarización Completada",
        description: "Certificado notarial generado y entregado",
        importance: 'high' as const
      }
    };

    const event = events[eventType] || events.document_created;
    const randomUser = this.demoUsers[Math.floor(Math.random() * this.demoUsers.length)];

    return {
      id: `demo_event_${Date.now()}`,
      type: eventType,
      title: event.title,
      description: event.description,
      timestamp: new Date(),
      user: randomUser?.fullName,
      importance: event.importance
    };
  }
}

// Instancia singleton para demo
export const demoDataManager = new DemoDataManager();