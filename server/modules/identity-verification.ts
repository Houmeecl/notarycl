import { securityManager } from "./security-manager";
import { simpleStorage } from "../simple-storage";
import crypto from "crypto";

export interface IdentityProvider {
  id: string;
  name: string;
  type: 'document_ocr' | 'facial_recognition' | 'liveness_detection' | 'knowledge_based' | 'database_verification';
  isActive: boolean;
  accuracy: number; // 0-100
  processingTime: number; // seconds
  cost: number; // per verification
  supportedDocuments: string[];
  supportedCountries: string[];
}

export interface BiometricData {
  id: string;
  type: 'facial' | 'fingerprint' | 'voice' | 'iris';
  data: string; // Base64 encoded biometric template
  quality: number; // 0-100
  extractedAt: Date;
  deviceInfo: string;
}

export interface LivenessCheck {
  id: string;
  type: 'blink_detection' | 'head_movement' | 'smile_detection' | 'voice_challenge';
  status: 'pending' | 'passed' | 'failed';
  challenge?: string;
  response?: string;
  confidence: number; // 0-100
  completedAt?: Date;
}

export interface KnowledgeBasedAuthentication {
  id: string;
  questions: KBAQuestion[];
  answers: KBAAnswer[];
  score: number; // 0-100
  status: 'pending' | 'passed' | 'failed';
  completedAt?: Date;
}

export interface KBAQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface KBAAnswer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpent: number; // seconds
}

export interface DocumentAnalysis {
  id: string;
  documentType: 'national_id' | 'passport' | 'drivers_license' | 'utility_bill' | 'bank_statement';
  frontImage: string;
  backImage?: string;
  extractedData: {
    fullName?: string;
    documentNumber?: string;
    dateOfBirth?: string;
    expirationDate?: string;
    issuingAuthority?: string;
    address?: string;
    nationality?: string;
  };
  securityFeatures: {
    hasWatermark: boolean;
    hasMRZ: boolean; // Machine Readable Zone
    hasHologram: boolean;
    hasUVFeatures: boolean;
    fontConsistency: number; // 0-100
    imageQuality: number; // 0-100
  };
  fraudIndicators: {
    isPhotocopied: boolean;
    isDigitallyAltered: boolean;
    hasInconsistentData: boolean;
    suspiciousPatterns: string[];
  };
  overallScore: number; // 0-100
  processingTime: number; // milliseconds
  analyzedAt: Date;
}

export interface VerificationSession {
  id: string;
  userId: number;
  purpose: 'document_signing' | 'account_verification' | 'ron_session' | 'payment_verification';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  methods: VerificationMethod[];
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredScore: number;
  expiresAt: Date;
  completedAt?: Date;
  failureReasons?: string[];
  metadata: {
    ipAddress: string;
    userAgent: string;
    deviceFingerprint: string;
    geoLocation?: {
      latitude: number;
      longitude: number;
      country: string;
      city: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationMethod {
  id: string;
  type: 'document_analysis' | 'biometric_verification' | 'liveness_check' | 'knowledge_based' | 'database_check';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  score: number; // 0-100
  weight: number; // Importance weight
  data?: any; // Method-specific data
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class IdentityVerificationManager {
  private providers: Map<string, IdentityProvider> = new Map();
  private verificationSessions: Map<string, VerificationSession> = new Map();
  private kbaQuestionBank: KBAQuestion[] = [];

  constructor() {
    this.initializeProviders();
    this.initializeKBAQuestions();
    console.log("🆔 Gestor de Verificación de Identidad inicializado");
  }

  private initializeProviders() {
    const providers: IdentityProvider[] = [
      {
        id: "document_ocr",
        name: "Análisis OCR de Documentos",
        type: "document_ocr",
        isActive: true,
        accuracy: 95,
        processingTime: 3,
        cost: 500, // CLP
        supportedDocuments: ["national_id", "passport", "drivers_license"],
        supportedCountries: ["CL", "AR", "PE", "CO", "MX"]
      },
      {
        id: "facial_recognition",
        name: "Reconocimiento Facial",
        type: "facial_recognition",
        isActive: true,
        accuracy: 92,
        processingTime: 2,
        cost: 300,
        supportedDocuments: ["any_with_photo"],
        supportedCountries: ["*"]
      },
      {
        id: "liveness_detection",
        name: "Detección de Vida",
        type: "liveness_detection",
        isActive: true,
        accuracy: 88,
        processingTime: 5,
        cost: 200,
        supportedDocuments: [],
        supportedCountries: ["*"]
      },
      {
        id: "knowledge_based",
        name: "Autenticación Basada en Conocimiento",
        type: "knowledge_based",
        isActive: true,
        accuracy: 85,
        processingTime: 120, // 2 minutes
        cost: 800,
        supportedDocuments: [],
        supportedCountries: ["CL", "AR", "PE"]
      },
      {
        id: "database_verification",
        name: "Verificación en Bases de Datos",
        type: "database_verification",
        isActive: true,
        accuracy: 98,
        processingTime: 1,
        cost: 1000,
        supportedDocuments: ["national_id", "passport"],
        supportedCountries: ["CL"]
      }
    ];

    providers.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  private initializeKBAQuestions() {
    this.kbaQuestionBank = [
      {
        id: "kba_1",
        question: "¿En qué comuna vivía hace 5 años?",
        options: ["Santiago", "Providencia", "Las Condes", "Ñuñoa", "No recuerdo"],
        correctAnswer: "Providencia",
        difficulty: "medium"
      },
      {
        id: "kba_2",
        question: "¿Cuál fue el nombre de su primera mascota?",
        options: ["Max", "Luna", "Rocky", "Bella", "No tuve mascota"],
        correctAnswer: "Luna",
        difficulty: "easy"
      },
      {
        id: "kba_3",
        question: "¿En qué año obtuvo su primera tarjeta de crédito?",
        options: ["2018", "2019", "2020", "2021", "No he tenido"],
        correctAnswer: "2019",
        difficulty: "hard"
      },
      {
        id: "kba_4",
        question: "¿Cuál es el nombre de la calle donde trabajó por primera vez?",
        options: ["Av. Providencia", "Av. Las Condes", "Av. Apoquindo", "Av. Vitacura", "No recuerdo"],
        correctAnswer: "Av. Providencia",
        difficulty: "medium"
      },
      {
        id: "kba_5",
        question: "¿Qué marca de vehículo ha tenido más recientemente?",
        options: ["Toyota", "Chevrolet", "Nissan", "Hyundai", "No he tenido vehículo"],
        correctAnswer: "Toyota",
        difficulty: "easy"
      }
    ];
  }

  // Métodos principales
  public createVerificationSession(
    userId: number,
    purpose: VerificationSession['purpose'],
    requiredMethods: string[],
    metadata: VerificationSession['metadata']
  ): string {
    const sessionId = `id_session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Determinar score requerido basado en el propósito
    const requiredScores = {
      'document_signing': 80,
      'account_verification': 70,
      'ron_session': 90,
      'payment_verification': 75
    };

    const methods: VerificationMethod[] = requiredMethods.map(methodType => ({
      id: `method_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      type: methodType as any,
      status: 'pending',
      score: 0,
      weight: this.getMethodWeight(methodType)
    }));

    const session: VerificationSession = {
      id: sessionId,
      userId,
      purpose,
      status: 'pending',
      methods,
      overallScore: 0,
      riskLevel: 'medium',
      requiredScore: requiredScores[purpose],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.verificationSessions.set(sessionId, session);

    // Log de seguridad
    securityManager.logSecurityEvent(
      'identity_verification',
      metadata.ipAddress,
      metadata.userAgent,
      `Sesión de verificación iniciada: ${purpose}`,
      'low',
      userId,
      { sessionId, purpose, requiredMethods }
    );

    console.log(`🆔 Sesión de verificación creada: ${sessionId} para usuario ${userId}`);
    return sessionId;
  }

  private getMethodWeight(methodType: string): number {
    const weights = {
      'document_analysis': 0.4,
      'biometric_verification': 0.3,
      'liveness_check': 0.15,
      'knowledge_based': 0.1,
      'database_check': 0.05
    };
    return weights[methodType] || 0.2;
  }

  // Análisis de documentos
  public analyzeDocument(
    sessionId: string,
    methodId: string,
    documentType: DocumentAnalysis['documentType'],
    frontImage: string,
    backImage?: string
  ): DocumentAnalysis {
    const session = this.verificationSessions.get(sessionId);
    if (!session) throw new Error("Sesión de verificación no encontrada");

    const method = session.methods.find(m => m.id === methodId);
    if (!method) throw new Error("Método de verificación no encontrado");

    const analysisId = `doc_analysis_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const startTime = Date.now();

    // Simulación de análisis de documento
    const analysis: DocumentAnalysis = {
      id: analysisId,
      documentType,
      frontImage,
      backImage,
      extractedData: this.simulateDataExtraction(documentType),
      securityFeatures: this.analyzeSecurityFeatures(frontImage, backImage),
      fraudIndicators: this.detectFraudIndicators(frontImage, backImage),
      overallScore: 0,
      processingTime: Date.now() - startTime,
      analyzedAt: new Date()
    };

    // Calcular score general
    analysis.overallScore = this.calculateDocumentScore(analysis);

    // Actualizar método
    method.status = analysis.overallScore >= 70 ? 'completed' : 'failed';
    method.score = analysis.overallScore;
    method.data = analysis;
    method.completedAt = new Date();

    if (analysis.overallScore < 70) {
      method.errorMessage = `Score insuficiente: ${analysis.overallScore}%. Indicadores de fraude detectados.`;
    }

    this.updateSessionScore(sessionId);

    console.log(`📄 Documento analizado: ${documentType} - Score: ${analysis.overallScore}%`);
    return analysis;
  }

  private simulateDataExtraction(documentType: DocumentAnalysis['documentType']): DocumentAnalysis['extractedData'] {
    const sampleData = {
      national_id: {
        fullName: "Juan Carlos Pérez González",
        documentNumber: "12.345.678-9",
        dateOfBirth: "1985-03-15",
        expirationDate: "2030-03-15",
        issuingAuthority: "Registro Civil de Chile",
        nationality: "Chilena"
      },
      passport: {
        fullName: "María Elena Rodríguez Silva",
        documentNumber: "AB123456",
        dateOfBirth: "1990-07-22",
        expirationDate: "2028-07-22",
        issuingAuthority: "Gobierno de Chile",
        nationality: "Chilena"
      },
      drivers_license: {
        fullName: "Carlos Alberto Muñoz Torres",
        documentNumber: "CL-12345678",
        dateOfBirth: "1988-11-10",
        expirationDate: "2026-11-10",
        issuingAuthority: "CONASET Chile"
      },
      utility_bill: {
        fullName: "Ana Patricia Silva Morales",
        address: "Av. Providencia 1234, Depto 567, Providencia, Santiago",
        issuingAuthority: "Enel Chile"
      },
      bank_statement: {
        fullName: "Roberto Carlos Fuentes López",
        address: "Calle Los Robles 890, Las Condes, Santiago",
        issuingAuthority: "Banco de Chile"
      }
    };

    return sampleData[documentType] || {};
  }

  private analyzeSecurityFeatures(frontImage: string, backImage?: string): DocumentAnalysis['securityFeatures'] {
    // Simulación de análisis de características de seguridad
    const imageQuality = this.calculateImageQuality(frontImage);
    
    return {
      hasWatermark: Math.random() > 0.3,
      hasMRZ: Math.random() > 0.4,
      hasHologram: Math.random() > 0.5,
      hasUVFeatures: Math.random() > 0.6,
      fontConsistency: Math.floor(Math.random() * 20) + 80, // 80-100
      imageQuality
    };
  }

  private detectFraudIndicators(frontImage: string, backImage?: string): DocumentAnalysis['fraudIndicators'] {
    // Simulación de detección de fraude
    const suspiciousPatterns: string[] = [];
    
    if (Math.random() < 0.1) suspiciousPatterns.push("Inconsistencia en fuentes");
    if (Math.random() < 0.05) suspiciousPatterns.push("Posible manipulación digital");
    if (Math.random() < 0.08) suspiciousPatterns.push("Calidad de imagen sospechosa");

    return {
      isPhotocopied: Math.random() < 0.05,
      isDigitallyAltered: Math.random() < 0.03,
      hasInconsistentData: Math.random() < 0.07,
      suspiciousPatterns
    };
  }

  private calculateImageQuality(image: string): number {
    // Simulación basada en el tamaño de la imagen base64
    const sizeScore = Math.min((image.length / 50000) * 50, 50); // Max 50 points for size
    const randomQuality = Math.floor(Math.random() * 50) + 30; // 30-80 random
    return Math.min(sizeScore + randomQuality, 100);
  }

  private calculateDocumentScore(analysis: DocumentAnalysis): number {
    let score = 0;

    // Características de seguridad (40%)
    const securityScore = (
      (analysis.securityFeatures.hasWatermark ? 10 : 0) +
      (analysis.securityFeatures.hasMRZ ? 10 : 0) +
      (analysis.securityFeatures.hasHologram ? 8 : 0) +
      (analysis.securityFeatures.hasUVFeatures ? 6 : 0) +
      (analysis.securityFeatures.fontConsistency * 0.06) // 0-6 points
    );
    score += Math.min(securityScore, 40);

    // Calidad de imagen (30%)
    score += (analysis.securityFeatures.imageQuality * 0.3);

    // Indicadores de fraude (30% - puntos negativos)
    let fraudPenalty = 0;
    if (analysis.fraudIndicators.isPhotocopied) fraudPenalty += 15;
    if (analysis.fraudIndicators.isDigitallyAltered) fraudPenalty += 20;
    if (analysis.fraudIndicators.hasInconsistentData) fraudPenalty += 10;
    fraudPenalty += analysis.fraudIndicators.suspiciousPatterns.length * 5;

    score = Math.max(score - fraudPenalty, 0);

    return Math.round(score);
  }

  // Verificación biométrica
  public performBiometricVerification(
    sessionId: string,
    methodId: string,
    biometricData: Omit<BiometricData, 'id' | 'extractedAt'>
  ): BiometricData {
    const session = this.verificationSessions.get(sessionId);
    if (!session) throw new Error("Sesión de verificación no encontrada");

    const method = session.methods.find(m => m.id === methodId);
    if (!method) throw new Error("Método de verificación no encontrado");

    const biometricId = `bio_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const biometric: BiometricData = {
      ...biometricData,
      id: biometricId,
      extractedAt: new Date()
    };

    // Simulación de verificación biométrica
    const verificationScore = this.calculateBiometricScore(biometric);

    method.status = verificationScore >= 80 ? 'completed' : 'failed';
    method.score = verificationScore;
    method.data = biometric;
    method.completedAt = new Date();

    if (verificationScore < 80) {
      method.errorMessage = `Verificación biométrica falló. Score: ${verificationScore}%`;
    }

    this.updateSessionScore(sessionId);

    console.log(`🔍 Verificación biométrica completada: ${biometric.type} - Score: ${verificationScore}%`);
    return biometric;
  }

  private calculateBiometricScore(biometric: BiometricData): number {
    let score = biometric.quality * 0.6; // 60% basado en calidad

    // Factores adicionales por tipo
    switch (biometric.type) {
      case 'facial':
        score += Math.random() * 30 + 10; // 10-40 points
        break;
      case 'fingerprint':
        score += Math.random() * 25 + 15; // 15-40 points
        break;
      case 'voice':
        score += Math.random() * 20 + 10; // 10-30 points
        break;
      case 'iris':
        score += Math.random() * 35 + 5; // 5-40 points
        break;
    }

    return Math.min(Math.round(score), 100);
  }

  // Detección de vida
  public performLivenessCheck(
    sessionId: string,
    methodId: string,
    checkType: LivenessCheck['type'],
    response?: string
  ): LivenessCheck {
    const session = this.verificationSessions.get(sessionId);
    if (!session) throw new Error("Sesión de verificación no encontrada");

    const method = session.methods.find(m => m.id === methodId);
    if (!method) throw new Error("Método de verificación no encontrado");

    const checkId = `liveness_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const livenessCheck: LivenessCheck = {
      id: checkId,
      type: checkType,
      status: 'pending',
      confidence: 0,
      response
    };

    // Generar desafío basado en el tipo
    switch (checkType) {
      case 'blink_detection':
        livenessCheck.challenge = "Parpadee 3 veces lentamente";
        break;
      case 'head_movement':
        livenessCheck.challenge = "Mueva la cabeza hacia la izquierda, luego hacia la derecha";
        break;
      case 'smile_detection':
        livenessCheck.challenge = "Sonría durante 2 segundos";
        break;
      case 'voice_challenge':
        livenessCheck.challenge = "Diga en voz alta: 'Confirmo mi identidad para DocuSignPro'";
        break;
    }

    // Simulación de verificación
    const confidence = Math.floor(Math.random() * 30) + 70; // 70-100%
    livenessCheck.confidence = confidence;
    livenessCheck.status = confidence >= 85 ? 'passed' : 'failed';
    livenessCheck.completedAt = new Date();

    // Actualizar método
    method.status = livenessCheck.status === 'passed' ? 'completed' : 'failed';
    method.score = confidence;
    method.data = livenessCheck;
    method.completedAt = new Date();

    this.updateSessionScore(sessionId);

    console.log(`👁️ Detección de vida completada: ${checkType} - Confianza: ${confidence}%`);
    return livenessCheck;
  }

  // Autenticación basada en conocimiento (KBA)
  public generateKBAQuestions(sessionId: string, methodId: string): KBAQuestion[] {
    const session = this.verificationSessions.get(sessionId);
    if (!session) throw new Error("Sesión de verificación no encontrada");

    // Seleccionar 3-5 preguntas aleatorias
    const questionCount = Math.floor(Math.random() * 3) + 3; // 3-5 preguntas
    const selectedQuestions = this.kbaQuestionBank
      .sort(() => Math.random() - 0.5)
      .slice(0, questionCount);

    const method = session.methods.find(m => m.id === methodId);
    if (method) {
      method.status = 'in_progress';
      method.startedAt = new Date();
      method.data = {
        questions: selectedQuestions,
        answers: [],
        startedAt: new Date()
      };
    }

    console.log(`❓ ${questionCount} preguntas KBA generadas para sesión ${sessionId}`);
    return selectedQuestions;
  }

  public submitKBAAnswers(
    sessionId: string,
    methodId: string,
    answers: Omit<KBAAnswer, 'isCorrect'>[]
  ): KnowledgeBasedAuthentication {
    const session = this.verificationSessions.get(sessionId);
    if (!session) throw new Error("Sesión de verificación no encontrada");

    const method = session.methods.find(m => m.id === methodId);
    if (!method || !method.data?.questions) throw new Error("Método KBA no encontrado");

    const questions: KBAQuestion[] = method.data.questions;
    
    // Evaluar respuestas
    const evaluatedAnswers: KBAAnswer[] = answers.map(answer => {
      const question = questions.find(q => q.id === answer.questionId);
      return {
        ...answer,
        isCorrect: question ? answer.selectedAnswer === question.correctAnswer : false
      };
    });

    const correctAnswers = evaluatedAnswers.filter(a => a.isCorrect).length;
    const score = Math.round((correctAnswers / questions.length) * 100);

    const kba: KnowledgeBasedAuthentication = {
      id: `kba_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      questions,
      answers: evaluatedAnswers,
      score,
      status: score >= 70 ? 'passed' : 'failed',
      completedAt: new Date()
    };

    // Actualizar método
    method.status = kba.status === 'passed' ? 'completed' : 'failed';
    method.score = score;
    method.data = kba;
    method.completedAt = new Date();

    this.updateSessionScore(sessionId);

    console.log(`🧠 KBA completado: ${correctAnswers}/${questions.length} correctas - Score: ${score}%`);
    return kba;
  }

  // Verificación en base de datos
  public performDatabaseVerification(
    sessionId: string,
    methodId: string,
    documentNumber: string,
    documentType: string
  ): {
    found: boolean;
    matchScore: number;
    verifiedData?: any;
    lastUpdate?: Date;
  } {
    const session = this.verificationSessions.get(sessionId);
    if (!session) throw new Error("Sesión de verificación no encontrada");

    const method = session.methods.find(m => m.id === methodId);
    if (!method) throw new Error("Método de verificación no encontrado");

    // Simulación de consulta a base de datos gubernamental
    const found = Math.random() > 0.1; // 90% de probabilidad de encontrar
    const matchScore = found ? Math.floor(Math.random() * 20) + 80 : 0; // 80-100% si se encuentra

    const result = {
      found,
      matchScore,
      verifiedData: found ? {
        documentNumber,
        status: 'valid',
        issuedDate: '2020-01-15',
        lastUpdate: new Date(2023, 5, 15)
      } : undefined,
      lastUpdate: found ? new Date(2023, 5, 15) : undefined
    };

    // Actualizar método
    method.status = found && matchScore >= 90 ? 'completed' : 'failed';
    method.score = matchScore;
    method.data = result;
    method.completedAt = new Date();

    if (!found) {
      method.errorMessage = "Documento no encontrado en base de datos gubernamental";
    } else if (matchScore < 90) {
      method.errorMessage = `Coincidencia parcial: ${matchScore}%`;
    }

    this.updateSessionScore(sessionId);

    console.log(`🗄️ Verificación en BD: ${found ? 'Encontrado' : 'No encontrado'} - Score: ${matchScore}%`);
    return result;
  }

  // Métodos de gestión de sesión
  private updateSessionScore(sessionId: string): void {
    const session = this.verificationSessions.get(sessionId);
    if (!session) return;

    const completedMethods = session.methods.filter(m => m.status === 'completed');
    
    if (completedMethods.length === 0) {
      session.overallScore = 0;
      return;
    }

    // Calcular score ponderado
    const weightedScore = completedMethods.reduce((sum, method) => {
      return sum + (method.score * method.weight);
    }, 0);

    const totalWeight = completedMethods.reduce((sum, method) => sum + method.weight, 0);
    session.overallScore = Math.round(weightedScore / totalWeight);

    // Determinar nivel de riesgo
    if (session.overallScore >= 90) {
      session.riskLevel = 'low';
    } else if (session.overallScore >= 75) {
      session.riskLevel = 'medium';
    } else if (session.overallScore >= 60) {
      session.riskLevel = 'high';
    } else {
      session.riskLevel = 'critical';
    }

    // Verificar si la sesión está completa
    const allMethodsComplete = session.methods.every(m => 
      m.status === 'completed' || m.status === 'failed' || m.status === 'skipped'
    );

    if (allMethodsComplete) {
      if (session.overallScore >= session.requiredScore) {
        session.status = 'completed';
        session.completedAt = new Date();
      } else {
        session.status = 'failed';
        session.failureReasons = session.methods
          .filter(m => m.status === 'failed')
          .map(m => m.errorMessage || `${m.type} falló`);
      }
    }

    session.updatedAt = new Date();
  }

  // Métodos de consulta
  public getVerificationSession(sessionId: string): VerificationSession | undefined {
    return this.verificationSessions.get(sessionId);
  }

  public getUserVerificationSessions(userId: number): VerificationSession[] {
    return Array.from(this.verificationSessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getVerificationStats(): {
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    averageScore: number;
    averageProcessingTime: number;
    methodSuccessRates: Record<string, number>;
    riskDistribution: Record<string, number>;
    fraudDetectionRate: number;
  } {
    const sessions = Array.from(this.verificationSessions.values());
    const completed = sessions.filter(s => s.status === 'completed');
    const failed = sessions.filter(s => s.status === 'failed');

    // Calcular score promedio
    const averageScore = completed.length > 0
      ? completed.reduce((sum, s) => sum + s.overallScore, 0) / completed.length
      : 0;

    // Calcular tiempo promedio de procesamiento
    const averageProcessingTime = completed.length > 0
      ? completed.reduce((sum, s) => {
          const duration = s.completedAt ? s.completedAt.getTime() - s.createdAt.getTime() : 0;
          return sum + duration;
        }, 0) / completed.length / 1000 // en segundos
      : 0;

    // Tasas de éxito por método
    const methodSuccessRates: Record<string, number> = {};
    const methodCounts: Record<string, { total: number; success: number }> = {};

    sessions.forEach(session => {
      session.methods.forEach(method => {
        if (!methodCounts[method.type]) {
          methodCounts[method.type] = { total: 0, success: 0 };
        }
        methodCounts[method.type].total++;
        if (method.status === 'completed') {
          methodCounts[method.type].success++;
        }
      });
    });

    Object.entries(methodCounts).forEach(([type, counts]) => {
      methodSuccessRates[type] = counts.total > 0 ? (counts.success / counts.total) * 100 : 0;
    });

    // Distribución de riesgo
    const riskDistribution: Record<string, number> = {};
    sessions.forEach(session => {
      riskDistribution[session.riskLevel] = (riskDistribution[session.riskLevel] || 0) + 1;
    });

    // Tasa de detección de fraude (simulada)
    const fraudDetectionRate = 2.5; // 2.5% de intentos fraudulentos detectados

    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      failedSessions: failed.length,
      averageScore: Math.round(averageScore),
      averageProcessingTime: Math.round(averageProcessingTime),
      methodSuccessRates,
      riskDistribution,
      fraudDetectionRate
    };
  }

  // Métodos de configuración
  public getAvailableProviders(): IdentityProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isActive);
  }

  public getRecommendedMethods(purpose: VerificationSession['purpose']): string[] {
    const recommendations = {
      'document_signing': ['document_analysis', 'liveness_check'],
      'account_verification': ['document_analysis', 'biometric_verification'],
      'ron_session': ['document_analysis', 'biometric_verification', 'liveness_check', 'knowledge_based'],
      'payment_verification': ['document_analysis', 'database_check']
    };

    return recommendations[purpose] || ['document_analysis'];
  }

  // Métodos de limpieza
  public cleanupExpiredSessions(): number {
    const now = new Date();
    let cleaned = 0;

    this.verificationSessions.forEach((session, id) => {
      if (session.status === 'pending' && now > session.expiresAt) {
        session.status = 'expired';
        session.updatedAt = now;
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} sesiones de verificación expiradas`);
    }

    return cleaned;
  }
}

// Instancia singleton
export const identityVerificationManager = new IdentityVerificationManager();

// Limpiar sesiones expiradas cada 30 minutos
setInterval(() => {
  identityVerificationManager.cleanupExpiredSessions();
}, 30 * 60 * 1000);