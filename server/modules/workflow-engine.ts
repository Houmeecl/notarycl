import { documentManager, type Document } from "./document-manager";
import { paymentManager, type PaymentIntent } from "./payment-manager";
import { identityVerificationManager, type VerificationSession } from "./identity-verification";
import { signatureManager } from "./signature-manager";
import { notaryManager } from "./notary-manager";
import { ronManager, type RONSession } from "./ron-manager";
import { securityManager } from "./security-manager";
import { simpleStorage } from "../simple-storage";

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'payment' | 'identity_verification' | 'document_review' | 'signature_collection' | 'notarization' | 'completion';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  isRequired: boolean;
  estimatedDuration: number; // minutes
  actualDuration?: number;
  dependencies: string[]; // IDs of steps that must be completed first
  data?: any;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface DocumentWorkflow {
  id: string;
  documentId: string;
  userId: number;
  workflowType: 'standard' | 'ron' | 'express' | 'premium';
  status: 'initiated' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  steps: WorkflowStep[];
  totalEstimatedTime: number;
  actualStartTime?: Date;
  actualCompletionTime?: Date;
  notifications: WorkflowNotification[];
  metadata: {
    isUrgent: boolean;
    requiresRON: boolean;
    requiresWitnesses: boolean;
    specialInstructions?: string;
    clientPreferences: {
      preferredNotificationMethod: 'email' | 'sms' | 'whatsapp';
      language: 'es' | 'en';
      timezone: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowNotification {
  id: string;
  type: 'step_started' | 'step_completed' | 'step_failed' | 'workflow_completed' | 'action_required' | 'reminder';
  recipient: {
    userId: number;
    email: string;
    phone?: string;
  };
  title: string;
  message: string;
  actionUrl?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  method: 'email' | 'sms' | 'whatsapp' | 'in_app';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sentAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  documentTypes: string[];
  steps: Omit<WorkflowStep, 'id' | 'status' | 'startedAt' | 'completedAt' | 'actualDuration'>[];
  isActive: boolean;
  createdAt: Date;
}

export interface BusinessRule {
  id: string;
  name: string;
  condition: string; // JSON logic expression
  action: {
    type: 'skip_step' | 'add_step' | 'change_workflow' | 'require_approval' | 'send_notification';
    parameters: any;
  };
  priority: number;
  isActive: boolean;
}

export class WorkflowEngine {
  private workflows: Map<string, DocumentWorkflow> = new Map();
  private workflowTemplates: Map<string, WorkflowTemplate> = new Map();
  private businessRules: Map<string, BusinessRule> = new Map();
  private notifications: Map<string, WorkflowNotification> = new Map();

  constructor() {
    this.initializeWorkflowTemplates();
    this.initializeBusinessRules();
    this.startWorkflowProcessor();
    console.log("⚙️ Motor de Flujo de Trabajo inicializado");
  }

  private initializeWorkflowTemplates() {
    // Plantilla de flujo estándar
    const standardTemplate: WorkflowTemplate = {
      id: "standard_workflow",
      name: "Flujo Estándar",
      description: "Flujo estándar para documentos regulares",
      documentTypes: ["rental_contract", "power_of_attorney"],
      steps: [
        {
          name: "Pago del Servicio",
          type: "payment",
          isRequired: true,
          estimatedDuration: 5,
          dependencies: []
        },
        {
          name: "Verificación de Identidad",
          type: "identity_verification",
          isRequired: true,
          estimatedDuration: 10,
          dependencies: ["payment"]
        },
        {
          name: "Revisión del Documento",
          type: "document_review",
          isRequired: true,
          estimatedDuration: 15,
          dependencies: ["identity_verification"]
        },
        {
          name: "Recolección de Firmas",
          type: "signature_collection",
          isRequired: true,
          estimatedDuration: 30,
          dependencies: ["document_review"]
        },
        {
          name: "Notarización",
          type: "notarization",
          isRequired: true,
          estimatedDuration: 45,
          dependencies: ["signature_collection"]
        },
        {
          name: "Finalización",
          type: "completion",
          isRequired: true,
          estimatedDuration: 5,
          dependencies: ["notarization"]
        }
      ],
      isActive: true,
      createdAt: new Date()
    };

    // Plantilla de flujo RON
    const ronTemplate: WorkflowTemplate = {
      id: "ron_workflow",
      name: "Flujo RON (Remote Online Notarization)",
      description: "Flujo para notarización remota online",
      documentTypes: ["rental_contract", "power_of_attorney"],
      steps: [
        {
          name: "Pago del Servicio RON",
          type: "payment",
          isRequired: true,
          estimatedDuration: 5,
          dependencies: []
        },
        {
          name: "Verificación de Identidad Avanzada",
          type: "identity_verification",
          isRequired: true,
          estimatedDuration: 20,
          dependencies: ["payment"]
        },
        {
          name: "Programación de Sesión RON",
          type: "document_review",
          isRequired: true,
          estimatedDuration: 10,
          dependencies: ["identity_verification"]
        },
        {
          name: "Sesión RON y Firmas",
          type: "signature_collection",
          isRequired: true,
          estimatedDuration: 60,
          dependencies: ["document_review"]
        },
        {
          name: "Notarización Digital",
          type: "notarization",
          isRequired: true,
          estimatedDuration: 15,
          dependencies: ["signature_collection"]
        },
        {
          name: "Certificación y Entrega",
          type: "completion",
          isRequired: true,
          estimatedDuration: 10,
          dependencies: ["notarization"]
        }
      ],
      isActive: true,
      createdAt: new Date()
    };

    this.workflowTemplates.set(standardTemplate.id, standardTemplate);
    this.workflowTemplates.set(ronTemplate.id, ronTemplate);
  }

  private initializeBusinessRules() {
    const rules: BusinessRule[] = [
      {
        id: "urgent_document_rule",
        name: "Documentos Urgentes",
        condition: JSON.stringify({ "metadata.isUrgent": true }),
        action: {
          type: "change_workflow",
          parameters: { newWorkflowType: "express" }
        },
        priority: 1,
        isActive: true
      },
      {
        id: "high_value_payment_rule",
        name: "Pagos de Alto Valor",
        condition: JSON.stringify({ "payment.amount": { ">": 100000 } }),
        action: {
          type: "add_step",
          parameters: { 
            stepType: "identity_verification",
            name: "Verificación Adicional",
            position: "after_payment"
          }
        },
        priority: 2,
        isActive: true
      },
      {
        id: "international_client_rule",
        name: "Cliente Internacional",
        condition: JSON.stringify({ "user.country": { "!=": "CL" } }),
        action: {
          type: "require_approval",
          parameters: { approvalLevel: "admin" }
        },
        priority: 3,
        isActive: true
      }
    ];

    rules.forEach(rule => {
      this.businessRules.set(rule.id, rule);
    });
  }

  private startWorkflowProcessor() {
    // Procesar flujos de trabajo cada 30 segundos
    setInterval(() => {
      this.processActiveWorkflows();
    }, 30000);

    // Enviar notificaciones pendientes cada minuto
    setInterval(() => {
      this.processNotifications();
    }, 60000);
  }

  // Métodos principales del motor de flujo
  public createDocumentWorkflow(
    documentId: string,
    userId: number,
    workflowType: DocumentWorkflow['workflowType'] = 'standard',
    metadata: Partial<DocumentWorkflow['metadata']> = {}
  ): string {
    const workflowId = `workflow_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Obtener plantilla de flujo
    const templateId = workflowType === 'ron' ? 'ron_workflow' : 'standard_workflow';
    const template = this.workflowTemplates.get(templateId);
    
    if (!template) {
      throw new Error(`Plantilla de flujo ${templateId} no encontrada`);
    }

    // Crear pasos basados en la plantilla
    const steps: WorkflowStep[] = template.steps.map((stepTemplate, index) => ({
      id: `step_${index + 1}_${stepTemplate.type}`,
      ...stepTemplate,
      status: index === 0 ? 'pending' : 'pending'
    }));

    // Aplicar reglas de negocio
    this.applyBusinessRules(steps, { documentId, userId, workflowType, metadata });

    const workflow: DocumentWorkflow = {
      id: workflowId,
      documentId,
      userId,
      workflowType,
      status: 'initiated',
      currentStep: steps[0].id,
      steps,
      totalEstimatedTime: steps.reduce((sum, step) => sum + step.estimatedDuration, 0),
      notifications: [],
      metadata: {
        isUrgent: false,
        requiresRON: workflowType === 'ron',
        requiresWitnesses: workflowType === 'ron',
        clientPreferences: {
          preferredNotificationMethod: 'email',
          language: 'es',
          timezone: 'America/Santiago'
        },
        ...metadata
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflows.set(workflowId, workflow);

    // Iniciar el primer paso
    this.startNextStep(workflowId);

    // Crear notificación inicial
    this.createNotification(workflowId, {
      type: 'step_started',
      title: 'Proceso de Documento Iniciado',
      message: `Su documento ha entrado en el proceso de ${template.name}. Tiempo estimado: ${workflow.totalEstimatedTime} minutos.`,
      priority: 'normal'
    });

    console.log(`⚙️ Flujo de trabajo creado: ${workflowId} (${workflowType})`);
    return workflowId;
  }

  private applyBusinessRules(steps: WorkflowStep[], context: any): void {
    this.businessRules.forEach(rule => {
      if (!rule.isActive) return;

      try {
        // Evaluar condición (simplificada)
        const shouldApply = this.evaluateCondition(rule.condition, context);
        
        if (shouldApply) {
          this.executeRuleAction(rule, steps, context);
        }
      } catch (error) {
        console.error(`Error aplicando regla ${rule.id}:`, error);
      }
    });
  }

  private evaluateCondition(condition: string, context: any): boolean {
    // Implementación simplificada de evaluación de condiciones
    try {
      const conditionObj = JSON.parse(condition);
      // En producción, usar una librería como JSONLogic
      return true; // Simplificado para demo
    } catch (error) {
      return false;
    }
  }

  private executeRuleAction(rule: BusinessRule, steps: WorkflowStep[], context: any): void {
    switch (rule.action.type) {
      case 'skip_step':
        const stepToSkip = steps.find(s => s.type === rule.action.parameters.stepType);
        if (stepToSkip) {
          stepToSkip.status = 'skipped';
          stepToSkip.isRequired = false;
        }
        break;
        
      case 'add_step':
        // Agregar paso adicional
        const newStep: WorkflowStep = {
          id: `rule_step_${Date.now()}`,
          name: rule.action.parameters.name,
          type: rule.action.parameters.stepType,
          status: 'pending',
          isRequired: true,
          estimatedDuration: rule.action.parameters.duration || 15,
          dependencies: []
        };
        steps.push(newStep);
        break;
    }
  }

  public advanceWorkflow(workflowId: string, stepId: string, stepData?: any): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'in_progress') return false;

    // Completar el paso actual
    step.status = 'completed';
    step.completedAt = new Date();
    step.data = stepData;
    
    if (step.startedAt) {
      step.actualDuration = Math.round((step.completedAt.getTime() - step.startedAt.getTime()) / 60000);
    }

    // Notificación de paso completado
    this.createNotification(workflowId, {
      type: 'step_completed',
      title: `${step.name} Completado`,
      message: `El paso "${step.name}" ha sido completado exitosamente.`,
      priority: 'normal'
    });

    // Verificar si el flujo está completo
    const allRequiredStepsCompleted = workflow.steps
      .filter(s => s.isRequired)
      .every(s => s.status === 'completed');

    if (allRequiredStepsCompleted) {
      this.completeWorkflow(workflowId);
    } else {
      // Iniciar siguiente paso
      this.startNextStep(workflowId);
    }

    workflow.updatedAt = new Date();
    console.log(`✅ Paso completado: ${step.name} en flujo ${workflowId}`);
    return true;
  }

  public failWorkflowStep(workflowId: string, stepId: string, errorMessage: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return false;

    step.status = 'failed';
    step.errorMessage = errorMessage;
    step.completedAt = new Date();

    // Determinar si el fallo es crítico
    if (step.isRequired) {
      workflow.status = 'failed';
      
      this.createNotification(workflowId, {
        type: 'step_failed',
        title: 'Error en el Proceso',
        message: `El paso "${step.name}" ha fallado: ${errorMessage}. El proceso ha sido detenido.`,
        priority: 'high'
      });
    } else {
      // Paso opcional fallido, continuar con el siguiente
      this.startNextStep(workflowId);
      
      this.createNotification(workflowId, {
        type: 'step_failed',
        title: 'Paso Opcional Fallido',
        message: `El paso opcional "${step.name}" ha fallado, pero el proceso continúa.`,
        priority: 'normal'
      });
    }

    workflow.updatedAt = new Date();
    console.log(`❌ Paso fallido: ${step.name} en flujo ${workflowId}`);
    return true;
  }

  private startNextStep(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    // Encontrar el siguiente paso pendiente que puede ejecutarse
    const nextStep = workflow.steps.find(step => {
      if (step.status !== 'pending') return false;
      
      // Verificar dependencias
      return step.dependencies.every(depId => {
        const depStep = workflow.steps.find(s => s.id === depId || s.type === depId);
        return depStep && depStep.status === 'completed';
      });
    });

    if (!nextStep) {
      console.log(`⚠️ No hay más pasos disponibles para flujo ${workflowId}`);
      return;
    }

    // Iniciar el paso
    nextStep.status = 'in_progress';
    nextStep.startedAt = new Date();
    workflow.currentStep = nextStep.id;
    workflow.status = 'in_progress';

    if (!workflow.actualStartTime) {
      workflow.actualStartTime = new Date();
    }

    // Ejecutar la lógica específica del paso
    this.executeStepLogic(workflowId, nextStep);

    console.log(`🚀 Iniciando paso: ${nextStep.name} en flujo ${workflowId}`);
  }

  private async executeStepLogic(workflowId: string, step: WorkflowStep): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    try {
      switch (step.type) {
        case 'payment':
          await this.handlePaymentStep(workflow, step);
          break;
          
        case 'identity_verification':
          await this.handleIdentityVerificationStep(workflow, step);
          break;
          
        case 'document_review':
          await this.handleDocumentReviewStep(workflow, step);
          break;
          
        case 'signature_collection':
          await this.handleSignatureCollectionStep(workflow, step);
          break;
          
        case 'notarization':
          await this.handleNotarizationStep(workflow, step);
          break;
          
        case 'completion':
          await this.handleCompletionStep(workflow, step);
          break;
      }
    } catch (error) {
      this.failWorkflowStep(workflowId, step.id, error.message);
    }
  }

  private async handlePaymentStep(workflow: DocumentWorkflow, step: WorkflowStep): Promise<void> {
    const document = documentManager.getDocument(workflow.documentId);
    if (!document) throw new Error("Documento no encontrado");

    const template = documentManager.getTemplate(document.templateId);
    if (!template) throw new Error("Plantilla no encontrada");

    // Calcular precio (RON tiene sobrecargo)
    const basePrice = template.price;
    const ronSurcharge = workflow.workflowType === 'ron' ? 20000 : 0;
    const urgentSurcharge = workflow.metadata.isUrgent ? 10000 : 0;
    const totalPrice = basePrice + ronSurcharge + urgentSurcharge;

    // Crear intención de pago
    const paymentIntent = paymentManager.createPaymentIntent(
      workflow.userId,
      totalPrice,
      "CLP",
      `Pago por ${template.name} ${workflow.workflowType === 'ron' ? '(RON)' : ''}`,
      {
        documentId: workflow.documentId,
        workflowId: workflow.id,
        type: 'document'
      },
      'mercadopago' // Proveedor por defecto
    );

    step.data = { paymentIntentId: paymentIntent.id, amount: totalPrice };

    // Actualizar estado del documento
    documentManager.updateDocumentStatus(workflow.documentId, 'pending_payment');

    // Crear notificación
    this.createNotification(workflow.id, {
      type: 'action_required',
      title: 'Pago Requerido',
      message: `Para continuar con el proceso, debe realizar el pago de $${totalPrice.toLocaleString()} CLP.`,
      actionUrl: `/payment/${paymentIntent.id}`,
      priority: 'high'
    });

    console.log(`💳 Paso de pago iniciado: $${totalPrice.toLocaleString()} CLP`);
  }

  private async handleIdentityVerificationStep(workflow: DocumentWorkflow, step: WorkflowStep): Promise<void> {
    const purpose = workflow.workflowType === 'ron' ? 'ron_session' : 'document_signing';
    const requiredMethods = workflow.workflowType === 'ron' 
      ? ['document_analysis', 'biometric_verification', 'liveness_check']
      : ['document_analysis', 'liveness_check'];

    // Crear sesión de verificación
    const verificationSessionId = identityVerificationManager.createVerificationSession(
      workflow.userId,
      purpose,
      requiredMethods,
      {
        ipAddress: '127.0.0.1', // Se actualizará en tiempo real
        userAgent: 'Workflow Engine',
        deviceFingerprint: `workflow_${workflow.id}`
      }
    );

    step.data = { verificationSessionId };

    // Actualizar estado del documento
    documentManager.updateDocumentStatus(workflow.documentId, 'pending_identity');

    // Crear notificación
    this.createNotification(workflow.id, {
      type: 'action_required',
      title: 'Verificación de Identidad Requerida',
      message: `Debe completar la verificación de identidad para continuar. Métodos requeridos: ${requiredMethods.join(', ')}.`,
      actionUrl: `/identity/verify/${verificationSessionId}`,
      priority: 'high'
    });

    console.log(`🆔 Paso de verificación iniciado: ${verificationSessionId}`);
  }

  private async handleDocumentReviewStep(workflow: DocumentWorkflow, step: WorkflowStep): Promise<void> {
    const document = documentManager.getDocument(workflow.documentId);
    if (!document) throw new Error("Documento no encontrado");

    // Generar HTML del documento
    const generatedHtml = documentManager.generateDocumentHtml(workflow.documentId);
    if (!generatedHtml) throw new Error("Error generando documento");

    // Verificar integridad
    const documentHash = securityManager.generateDocumentHash(generatedHtml);

    step.data = { 
      documentHash,
      reviewRequired: workflow.workflowType === 'ron',
      generatedAt: new Date()
    };

    // Actualizar estado del documento
    documentManager.updateDocumentStatus(workflow.documentId, 'pending_signature');

    if (workflow.workflowType === 'ron') {
      // Para RON, programar sesión
      this.createNotification(workflow.id, {
        type: 'action_required',
        title: 'Programar Sesión RON',
        message: 'Su documento está listo. Debe programar una sesión de notarización remota.',
        actionUrl: `/ron/schedule/${workflow.documentId}`,
        priority: 'high'
      });
    } else {
      // Para flujo estándar, proceder a firmas
      this.createNotification(workflow.id, {
        type: 'step_completed',
        title: 'Documento Revisado',
        message: 'Su documento ha sido revisado y está listo para la recolección de firmas.',
        priority: 'normal'
      });
    }

    console.log(`📄 Documento revisado: Hash ${documentHash.substring(0, 16)}...`);
  }

  private async handleSignatureCollectionStep(workflow: DocumentWorkflow, step: WorkflowStep): Promise<void> {
    const document = documentManager.getDocument(workflow.documentId);
    if (!document) throw new Error("Documento no encontrado");

    if (workflow.workflowType === 'ron') {
      // Para RON, las firmas se manejan en la sesión RON
      step.data = { 
        collectionMethod: 'ron_session',
        requiresVideoCall: true
      };

      this.createNotification(workflow.id, {
        type: 'action_required',
        title: 'Sesión RON Programada',
        message: 'Su sesión de notarización remota está programada. Recibirá un enlace para unirse.',
        priority: 'high'
      });
    } else {
      // Para flujo estándar, enviar solicitudes de firma
      const user = simpleStorage.findUserById(workflow.userId);
      if (!user) throw new Error("Usuario no encontrado");

      const signatureRequestId = signatureManager.createSignatureRequest({
        documentId: workflow.documentId,
        signerEmail: user.email,
        signerName: user.fullName,
        requesterUserId: workflow.userId,
        message: 'Por favor firme este documento para completar el proceso.'
      });

      step.data = { 
        signatureRequestId,
        collectionMethod: 'email_signature'
      };

      this.createNotification(workflow.id, {
        type: 'action_required',
        title: 'Firma Requerida',
        message: 'Se ha enviado una solicitud de firma a su email. Por favor complete la firma para continuar.',
        actionUrl: signatureManager.generateSignatureUrl(signatureRequestId),
        priority: 'high'
      });
    }

    console.log(`✍️ Recolección de firmas iniciada: ${step.data.collectionMethod}`);
  }

  private async handleNotarizationStep(workflow: DocumentWorkflow, step: WorkflowStep): Promise<void> {
    const document = documentManager.getDocument(workflow.documentId);
    if (!document) throw new Error("Documento no encontrado");

    if (workflow.workflowType === 'ron') {
      // Para RON, la notarización se maneja en la sesión RON
      step.data = {
        notarizationType: 'remote_online',
        requiresVideoRecording: true
      };
    } else {
      // Para flujo estándar, notarización presencial
      const availableNotaries = notaryManager.getAllActiveNotaries();
      if (availableNotaries.length === 0) {
        throw new Error("No hay notarios disponibles");
      }

      const selectedNotary = availableNotaries[0]; // Seleccionar el primero disponible
      
      // Crear cita de notarización
      const appointmentId = notaryManager.scheduleAppointment({
        notaryId: selectedNotary.id,
        clientId: workflow.userId,
        documentId: workflow.documentId,
        serviceType: 'document_notarization',
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
        duration: 60,
        location: 'office',
        feeEstimate: 25000
      });

      step.data = {
        notarizationType: 'in_person',
        appointmentId,
        notaryId: selectedNotary.id
      };

      this.createNotification(workflow.id, {
        type: 'action_required',
        title: 'Cita de Notarización Programada',
        message: `Su cita de notarización ha sido programada. Por favor asista a la oficina del notario.`,
        priority: 'high'
      });
    }

    console.log(`⚖️ Notarización iniciada: ${step.data.notarizationType}`);
  }

  private async handleCompletionStep(workflow: DocumentWorkflow, step: WorkflowStep): Promise<void> {
    const document = documentManager.getDocument(workflow.documentId);
    if (!document) throw new Error("Documento no encontrado");

    // Generar certificado final
    const completionCertificate = this.generateCompletionCertificate(workflow);
    
    step.data = {
      certificateId: completionCertificate.id,
      finalDocumentHash: completionCertificate.documentHash,
      completedAt: new Date()
    };

    // Actualizar estado final del documento
    documentManager.updateDocumentStatus(workflow.documentId, 'completed');

    // Notificación de finalización
    this.createNotification(workflow.id, {
      type: 'workflow_completed',
      title: 'Documento Completado',
      message: `Su documento ha sido completado exitosamente. Certificado: ${completionCertificate.id}`,
      actionUrl: `/documents/${workflow.documentId}/certificate`,
      priority: 'normal'
    });

    console.log(`🎉 Documento completado: ${completionCertificate.id}`);
  }

  private completeWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.actualCompletionTime = new Date();

    const totalTime = workflow.actualCompletionTime.getTime() - (workflow.actualStartTime?.getTime() || workflow.createdAt.getTime());
    const actualMinutes = Math.round(totalTime / 60000);

    console.log(`🏁 Flujo de trabajo completado: ${workflowId} en ${actualMinutes} minutos`);
  }

  private generateCompletionCertificate(workflow: DocumentWorkflow): {
    id: string;
    documentHash: string;
    workflowSummary: any;
  } {
    const document = documentManager.getDocument(workflow.documentId);
    const certificateId = `CERT_${new Date().getFullYear()}_${String(Date.now()).slice(-8)}`;
    
    const documentHash = document?.generatedHtml 
      ? securityManager.generateDocumentHash(document.generatedHtml)
      : 'unknown';

    const workflowSummary = {
      workflowId: workflow.id,
      documentId: workflow.documentId,
      workflowType: workflow.workflowType,
      completedSteps: workflow.steps.filter(s => s.status === 'completed').length,
      totalSteps: workflow.steps.length,
      totalTime: workflow.actualCompletionTime 
        ? Math.round((workflow.actualCompletionTime.getTime() - workflow.createdAt.getTime()) / 60000)
        : 0
    };

    return {
      id: certificateId,
      documentHash,
      workflowSummary
    };
  }

  private processActiveWorkflows(): void {
    this.workflows.forEach((workflow) => {
      if (workflow.status === 'in_progress') {
        // Verificar timeouts y estados
        this.checkWorkflowTimeouts(workflow);
        this.updateStepStatuses(workflow);
      }
    });
  }

  private checkWorkflowTimeouts(workflow: DocumentWorkflow): void {
    const now = new Date();
    const maxWorkflowTime = 7 * 24 * 60 * 60 * 1000; // 7 días

    if (now.getTime() - workflow.createdAt.getTime() > maxWorkflowTime) {
      workflow.status = 'failed';
      
      this.createNotification(workflow.id, {
        type: 'step_failed',
        title: 'Proceso Expirado',
        message: 'Su proceso ha expirado debido a inactividad prolongada.',
        priority: 'high'
      });
    }
  }

  private updateStepStatuses(workflow: DocumentWorkflow): void {
    workflow.steps.forEach(step => {
      if (step.status === 'in_progress') {
        this.checkStepCompletion(workflow, step);
      }
    });
  }

  private checkStepCompletion(workflow: DocumentWorkflow, step: WorkflowStep): void {
    switch (step.type) {
      case 'payment':
        this.checkPaymentCompletion(workflow, step);
        break;
      case 'identity_verification':
        this.checkIdentityVerificationCompletion(workflow, step);
        break;
      case 'signature_collection':
        this.checkSignatureCompletion(workflow, step);
        break;
    }
  }

  private checkPaymentCompletion(workflow: DocumentWorkflow, step: WorkflowStep): void {
    if (!step.data?.paymentIntentId) return;

    const payment = paymentManager.getPaymentIntent(step.data.paymentIntentId);
    if (!payment) return;

    if (payment.status === 'completed') {
      this.advanceWorkflow(workflow.id, step.id, { 
        paymentConfirmed: true,
        transactionId: payment.transactionId
      });
    } else if (payment.status === 'failed') {
      this.failWorkflowStep(workflow.id, step.id, 'Pago falló');
    }
  }

  private checkIdentityVerificationCompletion(workflow: DocumentWorkflow, step: WorkflowStep): void {
    if (!step.data?.verificationSessionId) return;

    const verification = identityVerificationManager.getVerificationSession(step.data.verificationSessionId);
    if (!verification) return;

    if (verification.status === 'completed') {
      this.advanceWorkflow(workflow.id, step.id, {
        verificationScore: verification.overallScore,
        riskLevel: verification.riskLevel
      });
    } else if (verification.status === 'failed') {
      this.failWorkflowStep(workflow.id, step.id, 'Verificación de identidad falló');
    }
  }

  private checkSignatureCompletion(workflow: DocumentWorkflow, step: WorkflowStep): void {
    const document = documentManager.getDocument(workflow.documentId);
    if (!document) return;

    // Verificar si tiene las firmas necesarias
    const requiredSignatures = 1; // Por ahora, solo una firma
    const currentSignatures = document.digitalSignatures.length;

    if (currentSignatures >= requiredSignatures) {
      this.advanceWorkflow(workflow.id, step.id, {
        signaturesCollected: currentSignatures,
        allSignaturesComplete: true
      });
    }
  }

  // Métodos de notificaciones
  private createNotification(
    workflowId: string,
    notification: Omit<WorkflowNotification, 'id' | 'recipient' | 'method' | 'status' | 'createdAt'>
  ): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const user = simpleStorage.findUserById(workflow.userId);
    if (!user) return;

    const notificationId = `notif_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const workflowNotification: WorkflowNotification = {
      ...notification,
      id: notificationId,
      recipient: {
        userId: workflow.userId,
        email: user.email,
        phone: user.phone
      },
      method: workflow.metadata.clientPreferences.preferredNotificationMethod,
      status: 'pending',
      createdAt: new Date()
    };

    this.notifications.set(notificationId, workflowNotification);
    workflow.notifications.push(workflowNotification);

    console.log(`📧 Notificación creada: ${notification.title}`);
  }

  private processNotifications(): void {
    const pendingNotifications = Array.from(this.notifications.values())
      .filter(n => n.status === 'pending');

    pendingNotifications.forEach(notification => {
      this.sendNotification(notification);
    });
  }

  private sendNotification(notification: WorkflowNotification): void {
    // Simulación de envío de notificación
    notification.status = 'sent';
    notification.sentAt = new Date();

    console.log(`📤 Notificación enviada: ${notification.title} a ${notification.recipient.email}`);
  }

  // Métodos de consulta
  public getWorkflow(workflowId: string): DocumentWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getUserWorkflows(userId: number): DocumentWorkflow[] {
    return Array.from(this.workflows.values())
      .filter(w => w.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getWorkflowByDocument(documentId: string): DocumentWorkflow | undefined {
    return Array.from(this.workflows.values())
      .find(w => w.documentId === documentId);
  }

  public getWorkflowStats(): {
    totalWorkflows: number;
    activeWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    averageCompletionTime: number;
    workflowsByType: Record<string, number>;
    stepSuccessRates: Record<string, number>;
    bottleneckSteps: { stepType: string; averageTime: number }[];
  } {
    const workflows = Array.from(this.workflows.values());
    const completed = workflows.filter(w => w.status === 'completed');
    const active = workflows.filter(w => w.status === 'in_progress');
    const failed = workflows.filter(w => w.status === 'failed');

    // Calcular tiempo promedio de finalización
    const averageCompletionTime = completed.length > 0
      ? completed.reduce((sum, w) => {
          const duration = w.actualCompletionTime 
            ? w.actualCompletionTime.getTime() - w.createdAt.getTime()
            : 0;
          return sum + duration;
        }, 0) / completed.length / 60000 // en minutos
      : 0;

    // Contar por tipo
    const workflowsByType: Record<string, number> = {};
    workflows.forEach(w => {
      workflowsByType[w.workflowType] = (workflowsByType[w.workflowType] || 0) + 1;
    });

    // Calcular tasas de éxito por paso
    const stepStats: Record<string, { total: number; completed: number; totalTime: number }> = {};
    
    workflows.forEach(workflow => {
      workflow.steps.forEach(step => {
        if (!stepStats[step.type]) {
          stepStats[step.type] = { total: 0, completed: 0, totalTime: 0 };
        }
        
        stepStats[step.type].total++;
        
        if (step.status === 'completed') {
          stepStats[step.type].completed++;
          stepStats[step.type].totalTime += step.actualDuration || step.estimatedDuration;
        }
      });
    });

    const stepSuccessRates: Record<string, number> = {};
    const bottleneckSteps: { stepType: string; averageTime: number }[] = [];

    Object.entries(stepStats).forEach(([stepType, stats]) => {
      stepSuccessRates[stepType] = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
      
      const averageTime = stats.completed > 0 ? stats.totalTime / stats.completed : 0;
      bottleneckSteps.push({ stepType, averageTime });
    });

    bottleneckSteps.sort((a, b) => b.averageTime - a.averageTime);

    return {
      totalWorkflows: workflows.length,
      activeWorkflows: active.length,
      completedWorkflows: completed.length,
      failedWorkflows: failed.length,
      averageCompletionTime: Math.round(averageCompletionTime),
      workflowsByType,
      stepSuccessRates,
      bottleneckSteps: bottleneckSteps.slice(0, 5)
    };
  }

  // Métodos de gestión manual
  public retryFailedStep(workflowId: string, stepId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'failed') return false;

    // Reiniciar el paso
    step.status = 'pending';
    step.errorMessage = undefined;
    step.startedAt = undefined;
    step.completedAt = undefined;

    // Reiniciar el flujo desde este paso
    workflow.status = 'in_progress';
    workflow.currentStep = step.id;

    this.executeStepLogic(workflowId, step);

    console.log(`🔄 Paso reiniciado: ${step.name} en flujo ${workflowId}`);
    return true;
  }

  public cancelWorkflow(workflowId: string, reason: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.status = 'cancelled';
    workflow.updatedAt = new Date();

    // Cancelar paso actual si existe
    const currentStep = workflow.steps.find(s => s.id === workflow.currentStep);
    if (currentStep && currentStep.status === 'in_progress') {
      currentStep.status = 'failed';
      currentStep.errorMessage = `Cancelado: ${reason}`;
      currentStep.completedAt = new Date();
    }

    // Actualizar documento
    documentManager.updateDocumentStatus(workflow.documentId, 'rejected', reason);

    this.createNotification(workflowId, {
      type: 'step_failed',
      title: 'Proceso Cancelado',
      message: `Su proceso ha sido cancelado: ${reason}`,
      priority: 'normal'
    });

    console.log(`❌ Flujo cancelado: ${workflowId} - ${reason}`);
    return true;
  }

  // Métodos de monitoreo y alertas
  public getWorkflowHealth(): {
    activeWorkflows: number;
    stuckWorkflows: number;
    averageProcessingTime: number;
    systemLoad: string;
    alerts: {
      type: string;
      message: string;
      count: number;
    }[];
  } {
    const workflows = Array.from(this.workflows.values());
    const active = workflows.filter(w => w.status === 'in_progress');
    
    // Detectar flujos atascados (más de 24 horas en el mismo paso)
    const now = new Date();
    const stuckWorkflows = active.filter(workflow => {
      const currentStep = workflow.steps.find(s => s.id === workflow.currentStep);
      if (!currentStep || !currentStep.startedAt) return false;
      
      const stepDuration = now.getTime() - currentStep.startedAt.getTime();
      return stepDuration > 24 * 60 * 60 * 1000; // 24 horas
    });

    // Calcular tiempo promedio de procesamiento
    const completed = workflows.filter(w => w.status === 'completed');
    const averageProcessingTime = completed.length > 0
      ? completed.reduce((sum, w) => {
          const duration = w.actualCompletionTime 
            ? w.actualCompletionTime.getTime() - w.createdAt.getTime()
            : 0;
          return sum + duration;
        }, 0) / completed.length / 60000
      : 0;

    // Determinar carga del sistema
    let systemLoad = 'normal';
    if (active.length > 50) systemLoad = 'high';
    if (active.length > 100) systemLoad = 'critical';

    // Generar alertas
    const alerts: { type: string; message: string; count: number }[] = [];
    
    if (stuckWorkflows.length > 0) {
      alerts.push({
        type: 'stuck_workflows',
        message: 'Flujos de trabajo atascados detectados',
        count: stuckWorkflows.length
      });
    }

    if (active.length > 30) {
      alerts.push({
        type: 'high_load',
        message: 'Alta carga de flujos activos',
        count: active.length
      });
    }

    return {
      activeWorkflows: active.length,
      stuckWorkflows: stuckWorkflows.length,
      averageProcessingTime: Math.round(averageProcessingTime),
      systemLoad,
      alerts
    };
  }

  // Integración con módulos externos
  public handleExternalEvent(eventType: string, eventData: any): void {
    switch (eventType) {
      case 'payment_completed':
        this.handlePaymentCompleted(eventData.paymentId);
        break;
      case 'identity_verified':
        this.handleIdentityVerified(eventData.sessionId);
        break;
      case 'signature_added':
        this.handleSignatureAdded(eventData.documentId);
        break;
      case 'ron_session_completed':
        this.handleRONSessionCompleted(eventData.sessionId);
        break;
    }
  }

  private handlePaymentCompleted(paymentId: string): void {
    const payment = paymentManager.getPaymentIntent(paymentId);
    if (!payment || !payment.metadata.workflowId) return;

    const workflow = this.workflows.get(payment.metadata.workflowId);
    if (!workflow) return;

    const paymentStep = workflow.steps.find(s => s.type === 'payment' && s.status === 'in_progress');
    if (paymentStep) {
      this.advanceWorkflow(workflow.id, paymentStep.id, {
        paymentConfirmed: true,
        transactionId: payment.transactionId
      });
    }
  }

  private handleIdentityVerified(sessionId: string): void {
    const verification = identityVerificationManager.getVerificationSession(sessionId);
    if (!verification) return;

    // Buscar flujo de trabajo asociado
    const workflow = Array.from(this.workflows.values()).find(w => {
      return w.steps.some(s => s.data?.verificationSessionId === sessionId);
    });

    if (!workflow) return;

    const identityStep = workflow.steps.find(s => 
      s.type === 'identity_verification' && s.status === 'in_progress'
    );

    if (identityStep) {
      this.advanceWorkflow(workflow.id, identityStep.id, {
        verificationScore: verification.overallScore,
        riskLevel: verification.riskLevel
      });
    }
  }

  private handleSignatureAdded(documentId: string): void {
    const workflow = this.getWorkflowByDocument(documentId);
    if (!workflow) return;

    const signatureStep = workflow.steps.find(s => 
      s.type === 'signature_collection' && s.status === 'in_progress'
    );

    if (signatureStep) {
      // Verificar si todas las firmas están completas
      this.checkSignatureCompletion(workflow, signatureStep);
    }
  }

  private handleRONSessionCompleted(sessionId: string): void {
    const ronSession = ronManager.getRONSession(sessionId);
    if (!ronSession) return;

    const workflow = this.getWorkflowByDocument(ronSession.documentId);
    if (!workflow) return;

    // Completar pasos de firma y notarización para RON
    const signatureStep = workflow.steps.find(s => s.type === 'signature_collection');
    const notarizationStep = workflow.steps.find(s => s.type === 'notarization');

    if (signatureStep && signatureStep.status === 'in_progress') {
      this.advanceWorkflow(workflow.id, signatureStep.id, {
        ronSessionId: sessionId,
        signaturesCollected: ronSession.digitalSignatures.length
      });
    }

    if (notarizationStep && notarizationStep.status === 'in_progress') {
      this.advanceWorkflow(workflow.id, notarizationStep.id, {
        ronSessionId: sessionId,
        notarizationCertificate: ronSession.notarizationCertificate
      });
    }
  }
}

// Instancia singleton
export const workflowEngine = new WorkflowEngine();

// Función helper para crear flujo automático cuando se crea un documento
export function createDocumentWithWorkflow(
  templateId: string,
  userId: number,
  formData: Record<string, any>,
  workflowOptions: {
    workflowType?: DocumentWorkflow['workflowType'];
    isUrgent?: boolean;
    requiresRON?: boolean;
    specialInstructions?: string;
  } = {}
): { document: Document; workflowId: string } {
  // Crear documento
  const document = documentManager.createDocument(templateId, userId, formData);
  
  // Crear flujo de trabajo
  const workflowId = workflowEngine.createDocumentWorkflow(
    document.id,
    userId,
    workflowOptions.workflowType || 'standard',
    {
      isUrgent: workflowOptions.isUrgent || false,
      requiresRON: workflowOptions.requiresRON || false,
      requiresWitnesses: workflowOptions.requiresRON || false,
      specialInstructions: workflowOptions.specialInstructions
    }
  );

  console.log(`📋 Documento creado con flujo: ${document.id} → ${workflowId}`);
  
  return { document, workflowId };
}