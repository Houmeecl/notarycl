import { documentManager, type Document } from "./document-manager";
import { notaryManager, type NotaryProfile } from "./notary-manager";
import { securityManager } from "./security-manager";
import { simpleStorage } from "../simple-storage";
import crypto from "crypto";

export interface RONSession {
  id: string;
  documentId: string;
  notaryId: number;
  clientId: number;
  status: 'scheduled' | 'waiting' | 'in_progress' | 'identity_verification' | 'document_review' | 'signing' | 'completed' | 'cancelled' | 'failed';
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  meetingUrl: string;
  meetingId: string;
  meetingPassword: string;
  recordingEnabled: boolean;
  recordingUrl?: string;
  participants: RONParticipant[];
  identityVerifications: IdentityVerification[];
  digitalSignatures: RONSignature[];
  notarizationCertificate?: string;
  sessionNotes?: string;
  complianceChecks: ComplianceCheck[];
  metadata: {
    clientIP: string;
    clientLocation?: GeoLocation;
    deviceInfo: string;
    browserInfo: string;
    sessionDuration?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RONParticipant {
  id: string;
  userId?: number;
  name: string;
  email: string;
  role: 'client' | 'witness' | 'notary';
  joinedAt?: Date;
  leftAt?: Date;
  identityVerified: boolean;
  consentGiven: boolean;
  ipAddress: string;
  deviceInfo: string;
}

export interface IdentityVerification {
  id: string;
  participantId: string;
  method: 'document_scan' | 'knowledge_based' | 'biometric' | 'credential_analysis';
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'requires_manual_review';
  documentType?: 'national_id' | 'passport' | 'drivers_license';
  documentImages?: string[]; // Base64 encoded images
  extractedData?: {
    fullName: string;
    documentNumber: string;
    dateOfBirth: string;
    expirationDate: string;
    issuingAuthority: string;
  };
  verificationScore: number; // 0-100
  failureReasons?: string[];
  verifiedAt?: Date;
  verifiedBy?: number; // Manual review by admin
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface RONSignature {
  id: string;
  participantId: string;
  documentPageNumber: number;
  signatureType: 'wet_signature' | 'digital_signature' | 'electronic_signature';
  signatureData: string; // Base64 signature image or digital cert
  timestamp: Date;
  ipAddress: string;
  geoLocation?: GeoLocation;
  witnessedBy: string[]; // Participant IDs
  notarySealed: boolean;
  certificateChain?: string[];
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  city?: string;
  country?: string;
  region?: string;
}

export interface ComplianceCheck {
  id: string;
  checkType: 'identity_verification' | 'document_integrity' | 'jurisdiction_compliance' | 'witness_requirements' | 'recording_compliance';
  status: 'pending' | 'passed' | 'failed' | 'warning';
  description: string;
  details?: string;
  requiredBy: string; // Legal requirement reference
  checkedAt: Date;
  checkedBy?: number; // User ID who performed check
}

export interface RONAvailability {
  notaryId: number;
  date: string; // YYYY-MM-DD
  timeSlots: {
    startTime: string; // HH:MM
    endTime: string;
    isAvailable: boolean;
    maxSessions: number;
    currentSessions: number;
  }[];
}

export interface VideoCallProvider {
  id: string;
  name: string;
  type: 'agora' | 'zoom' | 'webrtc' | 'jitsi';
  isActive: boolean;
  features: {
    recording: boolean;
    screenShare: boolean;
    chat: boolean;
    maxParticipants: number;
  };
  apiCredentials?: {
    appId?: string;
    appCertificate?: string;
    apiKey?: string;
    apiSecret?: string;
  };
}

export class RONManager {
  private ronSessions: Map<string, RONSession> = new Map();
  private ronAvailability: Map<number, RONAvailability[]> = new Map();
  private videoCallProviders: Map<string, VideoCallProvider> = new Map();
  private activeVideoSessions: Map<string, any> = new Map();

  constructor() {
    this.initializeVideoProviders();
    this.initializeNotaryAvailability();
    console.log("🎥 Gestor RON (Remote Online Notarization) inicializado");
  }

  private initializeVideoProviders() {
    const providers: VideoCallProvider[] = [
      {
        id: "agora",
        name: "Agora.io",
        type: "agora",
        isActive: true,
        features: {
          recording: true,
          screenShare: true,
          chat: true,
          maxParticipants: 10
        },
        apiCredentials: {
          appId: process.env.AGORA_APP_ID,
          appCertificate: process.env.AGORA_APP_CERTIFICATE
        }
      },
      {
        id: "webrtc",
        name: "WebRTC Nativo",
        type: "webrtc",
        isActive: true,
        features: {
          recording: false,
          screenShare: true,
          chat: false,
          maxParticipants: 4
        }
      },
      {
        id: "jitsi",
        name: "Jitsi Meet",
        type: "jitsi",
        isActive: true,
        features: {
          recording: true,
          screenShare: true,
          chat: true,
          maxParticipants: 8
        }
      }
    ];

    providers.forEach(provider => {
      this.videoCallProviders.set(provider.id, provider);
    });
  }

  private initializeNotaryAvailability() {
    // Configurar disponibilidad para notarios existentes
    const notaries = notaryManager.getAllActiveNotaries();
    
    notaries.forEach(notary => {
      const availability: RONAvailability[] = [];
      
      // Generar disponibilidad para los próximos 30 días
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Solo días laborables para RON
        if (date.getDay() >= 1 && date.getDay() <= 5) {
          availability.push({
            notaryId: notary.id,
            date: dateStr,
            timeSlots: [
              { startTime: "09:00", endTime: "10:00", isAvailable: true, maxSessions: 2, currentSessions: 0 },
              { startTime: "10:00", endTime: "11:00", isAvailable: true, maxSessions: 2, currentSessions: 0 },
              { startTime: "11:00", endTime: "12:00", isAvailable: true, maxSessions: 2, currentSessions: 0 },
              { startTime: "14:00", endTime: "15:00", isAvailable: true, maxSessions: 2, currentSessions: 0 },
              { startTime: "15:00", endTime: "16:00", isAvailable: true, maxSessions: 2, currentSessions: 0 },
              { startTime: "16:00", endTime: "17:00", isAvailable: true, maxSessions: 2, currentSessions: 0 }
            ]
          });
        }
      }
      
      this.ronAvailability.set(notary.id, availability);
    });
  }

  // Métodos principales de RON
  public scheduleRONSession(
    documentId: string,
    notaryId: number,
    clientId: number,
    scheduledAt: Date,
    participants: Omit<RONParticipant, 'id' | 'identityVerified' | 'consentGiven'>[]
  ): string {
    const sessionId = `ron_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const meetingId = `meeting_${Date.now()}`;
    const meetingPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Generar URL de reunión (simulada)
    const meetingUrl = `https://ron.docusignpro.com/session/${sessionId}?pwd=${meetingPassword}`;

    const ronParticipants: RONParticipant[] = participants.map(p => ({
      ...p,
      id: `participant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      identityVerified: false,
      consentGiven: false
    }));

    const session: RONSession = {
      id: sessionId,
      documentId,
      notaryId,
      clientId,
      status: 'scheduled',
      scheduledAt,
      meetingUrl,
      meetingId,
      meetingPassword,
      recordingEnabled: true,
      participants: ronParticipants,
      identityVerifications: [],
      digitalSignatures: [],
      complianceChecks: [],
      metadata: {
        clientIP: '127.0.0.1', // Se actualizará en tiempo real
        deviceInfo: 'Unknown',
        browserInfo: 'Unknown'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.ronSessions.set(sessionId, session);

    // Log de seguridad
    securityManager.logSecurityEvent(
      'admin_action',
      '127.0.0.1',
      'RON System',
      `Sesión RON programada: ${sessionId}`,
      'low',
      clientId,
      { sessionId, documentId, notaryId }
    );

    console.log(`🎥 Sesión RON programada: ${sessionId} para ${scheduledAt.toLocaleString()}`);
    return sessionId;
  }

  public startRONSession(sessionId: string, clientIP: string, deviceInfo: string): boolean {
    const session = this.ronSessions.get(sessionId);
    if (!session || session.status !== 'scheduled') {
      return false;
    }

    session.status = 'waiting';
    session.startedAt = new Date();
    session.metadata.clientIP = clientIP;
    session.metadata.deviceInfo = deviceInfo;
    session.updatedAt = new Date();

    // Inicializar checks de cumplimiento
    this.initializeComplianceChecks(sessionId);

    console.log(`🎬 Sesión RON ${sessionId} iniciada`);
    return true;
  }

  private initializeComplianceChecks(sessionId: string): void {
    const session = this.ronSessions.get(sessionId);
    if (!session) return;

    const complianceChecks: ComplianceCheck[] = [
      {
        id: `check_${Date.now()}_1`,
        checkType: 'identity_verification',
        status: 'pending',
        description: 'Verificación de identidad de todos los participantes',
        requiredBy: 'Chilean Notary Law Article 405',
        checkedAt: new Date()
      },
      {
        id: `check_${Date.now()}_2`,
        checkType: 'document_integrity',
        status: 'pending',
        description: 'Verificación de integridad del documento',
        requiredBy: 'Digital Signature Law 19.799',
        checkedAt: new Date()
      },
      {
        id: `check_${Date.now()}_3`,
        checkType: 'jurisdiction_compliance',
        status: 'pending',
        description: 'Verificación de jurisdicción del notario',
        requiredBy: 'Notary Code Article 12',
        checkedAt: new Date()
      },
      {
        id: `check_${Date.now()}_4`,
        checkType: 'witness_requirements',
        status: 'pending',
        description: 'Verificación de testigos requeridos',
        requiredBy: 'RON Regulation 2024',
        checkedAt: new Date()
      },
      {
        id: `check_${Date.now()}_5`,
        checkType: 'recording_compliance',
        status: 'pending',
        description: 'Grabación de sesión para auditoría',
        requiredBy: 'RON Technical Standards',
        checkedAt: new Date()
      }
    ];

    session.complianceChecks = complianceChecks;
  }

  public joinRONSession(sessionId: string, participantId: string, clientIP: string): {
    success: boolean;
    meetingInfo?: {
      meetingUrl: string;
      meetingId: string;
      meetingPassword: string;
    };
    error?: string;
  } {
    const session = this.ronSessions.get(sessionId);
    if (!session) {
      return { success: false, error: "Sesión no encontrada" };
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      return { success: false, error: "Participante no autorizado" };
    }

    // Actualizar información del participante
    participant.joinedAt = new Date();
    participant.ipAddress = clientIP;

    // Cambiar estado de la sesión si es necesario
    if (session.status === 'waiting') {
      session.status = 'in_progress';
    }

    session.updatedAt = new Date();

    console.log(`👤 Participante ${participant.name} se unió a sesión RON ${sessionId}`);

    return {
      success: true,
      meetingInfo: {
        meetingUrl: session.meetingUrl,
        meetingId: session.meetingId,
        meetingPassword: session.meetingPassword
      }
    };
  }

  public updateSessionStatus(sessionId: string, status: RONSession['status'], notes?: string): boolean {
    const session = this.ronSessions.get(sessionId);
    if (!session) return false;

    const previousStatus = session.status;
    session.status = status;
    session.updatedAt = new Date();

    if (notes) {
      session.sessionNotes = (session.sessionNotes || '') + `\n[${new Date().toLocaleTimeString()}] ${notes}`;
    }

    // Acciones específicas por estado
    switch (status) {
      case 'identity_verification':
        this.startIdentityVerification(sessionId);
        break;
      case 'document_review':
        this.startDocumentReview(sessionId);
        break;
      case 'signing':
        this.startSigningProcess(sessionId);
        break;
      case 'completed':
        this.completeRONSession(sessionId);
        break;
    }

    console.log(`📝 Sesión RON ${sessionId}: ${previousStatus} → ${status}`);
    return true;
  }

  private startIdentityVerification(sessionId: string): void {
    const session = this.ronSessions.get(sessionId);
    if (!session) return;

    // Iniciar verificación para cada participante que la requiera
    session.participants.forEach(participant => {
      if (participant.role !== 'notary' && !participant.identityVerified) {
        this.createIdentityVerification(sessionId, participant.id);
      }
    });
  }

  private startDocumentReview(sessionId: string): void {
    const session = this.ronSessions.get(sessionId);
    if (!session) return;

    // Verificar integridad del documento
    const document = documentManager.getDocument(session.documentId);
    if (document && document.generatedHtml) {
      const documentHash = securityManager.generateDocumentHash(document.generatedHtml);
      
      // Actualizar compliance check
      const integrityCheck = session.complianceChecks.find(c => c.checkType === 'document_integrity');
      if (integrityCheck) {
        integrityCheck.status = 'passed';
        integrityCheck.details = `Document hash: ${documentHash}`;
        integrityCheck.checkedAt = new Date();
      }
    }
  }

  private startSigningProcess(sessionId: string): void {
    const session = this.ronSessions.get(sessionId);
    if (!session) return;

    console.log(`✍️ Iniciando proceso de firma para sesión ${sessionId}`);
    
    // Aquí se enviarían instrucciones a los participantes para firmar
    session.sessionNotes = (session.sessionNotes || '') + 
      `\n[${new Date().toLocaleTimeString()}] Proceso de firma iniciado`;
  }

  private completeRONSession(sessionId: string): void {
    const session = this.ronSessions.get(sessionId);
    if (!session) return;

    session.completedAt = new Date();
    session.metadata.sessionDuration = session.completedAt.getTime() - (session.startedAt?.getTime() || session.createdAt.getTime());

    // Generar certificado de notarización RON
    const certificateId = this.generateRONCertificate(sessionId);
    session.notarizationCertificate = certificateId;

    // Actualizar documento principal
    const document = documentManager.getDocument(session.documentId);
    if (document) {
      documentManager.updateDocumentStatus(
        session.documentId,
        'completed',
        `Notarización remota completada. Certificado: ${certificateId}`
      );
    }

    console.log(`✅ Sesión RON ${sessionId} completada exitosamente`);
  }

  // Métodos de verificación de identidad
  public createIdentityVerification(sessionId: string, participantId: string): string {
    const session = this.ronSessions.get(sessionId);
    if (!session) throw new Error("Sesión no encontrada");

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) throw new Error("Participante no encontrado");

    const verificationId = `id_ver_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    const verification: IdentityVerification = {
      id: verificationId,
      participantId,
      method: 'document_scan', // Método por defecto
      status: 'pending',
      verificationScore: 0,
      createdAt: new Date()
    };

    session.identityVerifications.push(verification);
    session.updatedAt = new Date();

    console.log(`🆔 Verificación de identidad iniciada para ${participant.name}: ${verificationId}`);
    return verificationId;
  }

  public processIdentityDocument(
    sessionId: string,
    verificationId: string,
    documentType: IdentityVerification['documentType'],
    documentImages: string[]
  ): {
    success: boolean;
    extractedData?: IdentityVerification['extractedData'];
    verificationScore: number;
    errors?: string[];
  } {
    const session = this.ronSessions.get(sessionId);
    if (!session) return { success: false, verificationScore: 0, errors: ["Sesión no encontrada"] };

    const verification = session.identityVerifications.find(v => v.id === verificationId);
    if (!verification) return { success: false, verificationScore: 0, errors: ["Verificación no encontrada"] };

    // Simulación de procesamiento de documento de identidad
    const extractedData = this.simulateDocumentExtraction(documentType);
    const verificationScore = this.calculateVerificationScore(documentImages, extractedData);

    verification.documentType = documentType;
    verification.documentImages = documentImages;
    verification.extractedData = extractedData;
    verification.verificationScore = verificationScore;

    if (verificationScore >= 80) {
      verification.status = 'passed';
      verification.verifiedAt = new Date();
      
      // Marcar participante como verificado
      const participant = session.participants.find(p => p.id === verification.participantId);
      if (participant) {
        participant.identityVerified = true;
      }
    } else if (verificationScore >= 60) {
      verification.status = 'requires_manual_review';
    } else {
      verification.status = 'failed';
      verification.failureReasons = ["Calidad de imagen insuficiente", "Datos no legibles"];
    }

    session.updatedAt = new Date();

    console.log(`🔍 Documento de identidad procesado: Score ${verificationScore}% - Estado: ${verification.status}`);

    return {
      success: true,
      extractedData,
      verificationScore,
      errors: verification.failureReasons
    };
  }

  private simulateDocumentExtraction(documentType?: IdentityVerification['documentType']): IdentityVerification['extractedData'] {
    // Simulación de extracción de datos de documento
    const sampleData = {
      national_id: {
        fullName: "Juan Carlos Pérez González",
        documentNumber: "12.345.678-9",
        dateOfBirth: "1985-03-15",
        expirationDate: "2030-03-15",
        issuingAuthority: "Registro Civil de Chile"
      },
      passport: {
        fullName: "María Elena Rodríguez Silva",
        documentNumber: "AB123456",
        dateOfBirth: "1990-07-22",
        expirationDate: "2028-07-22",
        issuingAuthority: "Gobierno de Chile"
      },
      drivers_license: {
        fullName: "Carlos Alberto Muñoz Torres",
        documentNumber: "CL-12345678",
        dateOfBirth: "1988-11-10",
        expirationDate: "2026-11-10",
        issuingAuthority: "CONASET Chile"
      }
    };

    return sampleData[documentType || 'national_id'];
  }

  private calculateVerificationScore(images: string[], extractedData?: any): number {
    // Simulación de cálculo de score de verificación
    let score = 50; // Base score

    // Calidad de imágenes
    if (images.length >= 2) score += 20;
    if (images.every(img => img.length > 10000)) score += 15; // Imágenes de buena calidad

    // Datos extraídos
    if (extractedData) {
      if (extractedData.fullName && extractedData.documentNumber) score += 10;
      if (extractedData.dateOfBirth && extractedData.expirationDate) score += 5;
    }

    return Math.min(score, 100);
  }

  // Métodos de firma digital en RON
  public addRONSignature(
    sessionId: string,
    participantId: string,
    signatureData: string,
    pageNumber: number,
    witnessIds: string[]
  ): boolean {
    const session = this.ronSessions.get(sessionId);
    if (!session || session.status !== 'signing') {
      return false;
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant || !participant.identityVerified) {
      return false;
    }

    const signatureId = `ron_sig_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    const ronSignature: RONSignature = {
      id: signatureId,
      participantId,
      documentPageNumber: pageNumber,
      signatureType: 'digital_signature',
      signatureData,
      timestamp: new Date(),
      ipAddress: participant.ipAddress,
      witnessedBy: witnessIds,
      notarySealed: false, // Se aplicará después
      certificateChain: []
    };

    session.digitalSignatures.push(ronSignature);
    session.updatedAt = new Date();

    // Verificar si todas las firmas están completas
    const requiredSignatures = session.participants.filter(p => p.role === 'client').length;
    if (session.digitalSignatures.length >= requiredSignatures) {
      this.updateSessionStatus(sessionId, 'completed');
    }

    console.log(`✍️ Firma RON agregada: ${signatureId} por ${participant.name}`);
    return true;
  }

  // Métodos de gestión de videollamadas
  public generateVideoCallCredentials(sessionId: string, participantId: string): {
    provider: string;
    credentials: any;
  } {
    const session = this.ronSessions.get(sessionId);
    if (!session) throw new Error("Sesión no encontrada");

    // Usar Agora por defecto si está disponible
    const agoraProvider = this.videoCallProviders.get('agora');
    if (agoraProvider && agoraProvider.isActive) {
      return {
        provider: 'agora',
        credentials: {
          appId: agoraProvider.apiCredentials?.appId,
          channel: session.meetingId,
          token: this.generateAgoraToken(session.meetingId, participantId),
          uid: parseInt(participantId.slice(-6), 16) // Generar UID único
        }
      };
    }

    // Fallback a WebRTC
    return {
      provider: 'webrtc',
      credentials: {
        roomId: session.meetingId,
        participantId,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    };
  }

  private generateAgoraToken(channelName: string, participantId: string): string {
    // Simulación de generación de token Agora
    // En producción, usar la librería oficial de Agora
    const timestamp = Math.floor(Date.now() / 1000);
    const expireTime = timestamp + 3600; // 1 hora
    
    return Buffer.from(`${channelName}:${participantId}:${expireTime}`).toString('base64');
  }

  // Métodos de certificación RON
  private generateRONCertificate(sessionId: string): string {
    const session = this.ronSessions.get(sessionId);
    if (!session) throw new Error("Sesión no encontrada");

    const certificateId = `RON_CERT_${new Date().getFullYear()}_${String(Date.now()).slice(-8)}`;
    const notary = notaryManager.getNotaryProfile(session.notaryId);
    const document = documentManager.getDocument(session.documentId);

    if (!notary || !document) throw new Error("Información incompleta para certificado");

    // Crear registro de notarización RON
    const recordId = notaryManager.notarizeDocument(
      session.documentId,
      session.notaryId,
      session.clientId,
      'remote_online_notarization',
      {
        location: 'Remote Online Session',
        witnessCount: session.participants.filter(p => p.role === 'witness').length,
        witnessNames: session.participants
          .filter(p => p.role === 'witness')
          .map(p => p.name),
        notes: `RON Session: ${sessionId}. Duration: ${session.metadata.sessionDuration || 0}ms. Recording: ${session.recordingUrl || 'Available'}`,
        fee: 35000 // RON premium fee
      }
    );

    console.log(`📜 Certificado RON generado: ${certificateId} para sesión ${sessionId}`);
    return certificateId;
  }

  // Métodos de consulta y estadísticas
  public getRONSession(sessionId: string): RONSession | undefined {
    return this.ronSessions.get(sessionId);
  }

  public getNotaryRONSessions(notaryId: number, filters?: {
    status?: RONSession['status'];
    startDate?: Date;
    endDate?: Date;
  }): RONSession[] {
    let sessions = Array.from(this.ronSessions.values()).filter(s => s.notaryId === notaryId);

    if (filters) {
      if (filters.status) {
        sessions = sessions.filter(s => s.status === filters.status);
      }
      
      if (filters.startDate) {
        sessions = sessions.filter(s => s.scheduledAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        sessions = sessions.filter(s => s.scheduledAt <= filters.endDate!);
      }
    }

    return sessions.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  }

  public getClientRONSessions(clientId: number): RONSession[] {
    return Array.from(this.ronSessions.values())
      .filter(s => s.clientId === clientId)
      .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  }

  public getRONAvailability(notaryId: number, date?: string): RONAvailability[] {
    const availability = this.ronAvailability.get(notaryId) || [];
    
    if (date) {
      return availability.filter(a => a.date === date);
    }
    
    return availability;
  }

  public getRONStats(): {
    totalSessions: number;
    completedSessions: number;
    averageSessionDuration: number;
    successRate: number;
    totalParticipants: number;
    identityVerificationRate: number;
    complianceRate: number;
    sessionsByStatus: Record<string, number>;
    monthlyTrend: { month: string; sessions: number }[];
  } {
    const sessions = Array.from(this.ronSessions.values());
    const completedSessions = sessions.filter(s => s.status === 'completed');
    
    // Calcular duración promedio
    const totalDuration = completedSessions.reduce((sum, session) => {
      return sum + (session.metadata.sessionDuration || 0);
    }, 0);
    
    const averageSessionDuration = completedSessions.length > 0 
      ? totalDuration / completedSessions.length / (1000 * 60) // en minutos
      : 0;

    // Contar por estado
    const sessionsByStatus: Record<string, number> = {};
    sessions.forEach(session => {
      sessionsByStatus[session.status] = (sessionsByStatus[session.status] || 0) + 1;
    });

    // Calcular tasas
    const totalParticipants = sessions.reduce((sum, s) => sum + s.participants.length, 0);
    const verifiedParticipants = sessions.reduce((sum, s) => 
      sum + s.participants.filter(p => p.identityVerified).length, 0);
    
    const passedComplianceChecks = sessions.reduce((sum, s) => 
      sum + s.complianceChecks.filter(c => c.status === 'passed').length, 0);
    const totalComplianceChecks = sessions.reduce((sum, s) => sum + s.complianceChecks.length, 0);

    // Tendencia mensual (últimos 6 meses)
    const monthlyTrend: { month: string; sessions: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toLocaleDateString('es-CL', { year: 'numeric', month: 'short' });
      
      const monthSessions = sessions.filter(s => {
        const sessionMonth = s.createdAt.getMonth();
        const sessionYear = s.createdAt.getFullYear();
        return sessionMonth === date.getMonth() && sessionYear === date.getFullYear();
      }).length;
      
      monthlyTrend.push({ month: monthStr, sessions: monthSessions });
    }

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      averageSessionDuration: Math.round(averageSessionDuration),
      successRate: sessions.length > 0 ? (completedSessions.length / sessions.length) * 100 : 0,
      totalParticipants,
      identityVerificationRate: totalParticipants > 0 ? (verifiedParticipants / totalParticipants) * 100 : 0,
      complianceRate: totalComplianceChecks > 0 ? (passedComplianceChecks / totalComplianceChecks) * 100 : 0,
      sessionsByStatus,
      monthlyTrend
    };
  }

  // Métodos de cumplimiento y auditoría
  public validateRONCompliance(sessionId: string): {
    isCompliant: boolean;
    passedChecks: number;
    totalChecks: number;
    failedChecks: ComplianceCheck[];
    warnings: string[];
  } {
    const session = this.ronSessions.get(sessionId);
    if (!session) throw new Error("Sesión no encontrada");

    const passedChecks = session.complianceChecks.filter(c => c.status === 'passed');
    const failedChecks = session.complianceChecks.filter(c => c.status === 'failed');
    const warnings: string[] = [];

    // Verificaciones adicionales
    if (session.participants.filter(p => p.role === 'witness').length < 1) {
      warnings.push("Se recomienda al menos un testigo para RON");
    }

    if (!session.recordingEnabled) {
      warnings.push("La grabación es requerida para auditoría");
    }

    if (session.identityVerifications.some(v => v.verificationScore < 80)) {
      warnings.push("Algunas verificaciones de identidad tienen score bajo");
    }

    const isCompliant = failedChecks.length === 0 && 
                       session.participants.every(p => p.role === 'notary' || p.identityVerified);

    return {
      isCompliant,
      passedChecks: passedChecks.length,
      totalChecks: session.complianceChecks.length,
      failedChecks,
      warnings
    };
  }

  public getRONAuditTrail(sessionId: string): {
    session: RONSession;
    timeline: {
      timestamp: Date;
      event: string;
      actor: string;
      details?: string;
    }[];
    complianceReport: any;
    securityEvents: any[];
  } {
    const session = this.ronSessions.get(sessionId);
    if (!session) throw new Error("Sesión no encontrada");

    // Construir timeline de eventos
    const timeline: any[] = [
      {
        timestamp: session.createdAt,
        event: 'Sesión programada',
        actor: 'Sistema',
        details: `Programada para ${session.scheduledAt.toLocaleString()}`
      }
    ];

    if (session.startedAt) {
      timeline.push({
        timestamp: session.startedAt,
        event: 'Sesión iniciada',
        actor: 'Sistema'
      });
    }

    // Agregar eventos de participantes
    session.participants.forEach(participant => {
      if (participant.joinedAt) {
        timeline.push({
          timestamp: participant.joinedAt,
          event: 'Participante se unió',
          actor: participant.name,
          details: `Rol: ${participant.role}`
        });
      }
    });

    // Agregar verificaciones de identidad
    session.identityVerifications.forEach(verification => {
      timeline.push({
        timestamp: verification.createdAt,
        event: 'Verificación de identidad',
        actor: 'Sistema',
        details: `Score: ${verification.verificationScore}% - Estado: ${verification.status}`
      });
    });

    // Agregar firmas
    session.digitalSignatures.forEach(signature => {
      timeline.push({
        timestamp: signature.timestamp,
        event: 'Firma aplicada',
        actor: session.participants.find(p => p.id === signature.participantId)?.name || 'Desconocido',
        details: `Página ${signature.documentPageNumber}`
      });
    });

    if (session.completedAt) {
      timeline.push({
        timestamp: session.completedAt,
        event: 'Sesión completada',
        actor: 'Sistema',
        details: `Duración: ${Math.round((session.metadata.sessionDuration || 0) / 60000)} minutos`
      });
    }

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Obtener eventos de seguridad relacionados
    const securityEvents = securityManager.getSecurityEvents({
      startDate: session.createdAt,
      endDate: session.completedAt || new Date()
    }).filter(event => 
      event.metadata?.sessionId === sessionId ||
      session.participants.some(p => p.ipAddress === event.ipAddress)
    );

    return {
      session,
      timeline,
      complianceReport: this.validateRONCompliance(sessionId),
      securityEvents
    };
  }

  // Métodos de búsqueda y filtrado
  public searchRONSessions(query: string, filters?: {
    status?: RONSession['status'];
    notaryId?: number;
    startDate?: Date;
    endDate?: Date;
  }): RONSession[] {
    let sessions = Array.from(this.ronSessions.values());

    if (filters) {
      if (filters.status) {
        sessions = sessions.filter(s => s.status === filters.status);
      }
      
      if (filters.notaryId) {
        sessions = sessions.filter(s => s.notaryId === filters.notaryId);
      }
      
      if (filters.startDate) {
        sessions = sessions.filter(s => s.scheduledAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        sessions = sessions.filter(s => s.scheduledAt <= filters.endDate!);
      }
    }

    if (query) {
      sessions = sessions.filter(session => {
        const document = documentManager.getDocument(session.documentId);
        const notary = notaryManager.getNotaryProfile(session.notaryId);
        const notaryUser = notary ? simpleStorage.findUserById(notary.userId) : null;
        
        return session.id.toLowerCase().includes(query.toLowerCase()) ||
               document?.title.toLowerCase().includes(query.toLowerCase()) ||
               notaryUser?.fullName.toLowerCase().includes(query.toLowerCase()) ||
               session.participants.some(p => p.name.toLowerCase().includes(query.toLowerCase()));
      });
    }

    return sessions.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  }
}

// Instancia singleton
export const ronManager = new RONManager();