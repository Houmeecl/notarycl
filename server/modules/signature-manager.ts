import { documentManager, type Document, type DigitalSignature } from "./document-manager";
import { simpleStorage } from "../simple-storage";
import crypto from "crypto";

export interface SignatureRequest {
  documentId: string;
  signerEmail: string;
  signerName: string;
  requesterUserId: number;
  message?: string;
  expiresAt: Date;
}

export interface SignaturePad {
  width: number;
  height: number;
  penColor: string;
  backgroundColor: string;
  minWidth: number;
  maxWidth: number;
}

export interface SignatureVerification {
  isValid: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export class SignatureManager {
  private signatureRequests: Map<string, SignatureRequest> = new Map();
  private pendingSignatures: Map<string, { token: string; expiresAt: Date }> = new Map();

  constructor() {
    console.log("🖊️ Gestor de Firmas Digitales inicializado");
  }

  /**
   * Crear una solicitud de firma
   */
  public createSignatureRequest(request: Omit<SignatureRequest, 'expiresAt'>): string {
    const requestId = `sig_req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const token = crypto.randomBytes(32).toString('hex');
    
    const signatureRequest: SignatureRequest = {
      ...request,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    };

    this.signatureRequests.set(requestId, signatureRequest);
    this.pendingSignatures.set(requestId, {
      token,
      expiresAt: signatureRequest.expiresAt
    });

    // Agregar evento al documento
    const document = documentManager.getDocument(request.documentId);
    if (document) {
      document.timeline.push({
        id: `event_${Date.now()}`,
        type: 'updated',
        description: `Solicitud de firma enviada a ${request.signerEmail}`,
        userId: request.requesterUserId,
        metadata: { requestId, signerEmail: request.signerEmail },
        timestamp: new Date()
      });
      
      // Cambiar estado del documento
      documentManager.updateDocumentStatus(request.documentId, 'pending_signature');
    }

    console.log(`📧 Solicitud de firma creada: ${requestId} para ${request.signerEmail}`);
    return requestId;
  }

  /**
   * Obtener solicitud de firma por token
   */
  public getSignatureRequestByToken(requestId: string, token: string): SignatureRequest | null {
    const pendingSignature = this.pendingSignatures.get(requestId);
    
    if (!pendingSignature || pendingSignature.token !== token) {
      return null;
    }

    if (new Date() > pendingSignature.expiresAt) {
      this.pendingSignatures.delete(requestId);
      return null;
    }

    return this.signatureRequests.get(requestId) || null;
  }

  /**
   * Aplicar firma digital al documento
   */
  public applyDigitalSignature(
    requestId: string, 
    token: string,
    signatureData: string,
    verification: SignatureVerification
  ): boolean {
    const request = this.getSignatureRequestByToken(requestId, token);
    if (!request) {
      return false;
    }

    const success = documentManager.addDigitalSignature(request.documentId, {
      signerName: request.signerName,
      signerEmail: request.signerEmail,
      signatureData,
      ipAddress: verification.ipAddress
    });

    if (success) {
      // Limpiar solicitud pendiente
      this.pendingSignatures.delete(requestId);
      
      console.log(`✅ Firma aplicada exitosamente al documento ${request.documentId}`);
      return true;
    }

    return false;
  }

  /**
   * Generar URL de firma
   */
  public generateSignatureUrl(requestId: string): string | null {
    const pendingSignature = this.pendingSignatures.get(requestId);
    if (!pendingSignature) return null;

    return `/sign/${requestId}?token=${pendingSignature.token}`;
  }

  /**
   * Verificar firma digital
   */
  public verifySignature(signatureId: string): SignatureVerification {
    // Simulación de verificación
    return {
      isValid: true,
      timestamp: new Date(),
      ipAddress: "127.0.0.1",
      userAgent: "DocuSignPro/1.0"
    };
  }

  /**
   * Obtener configuración del pad de firma
   */
  public getSignaturePadConfig(): SignaturePad {
    return {
      width: 400,
      height: 200,
      penColor: "#000000",
      backgroundColor: "#ffffff",
      minWidth: 1,
      maxWidth: 3
    };
  }

  /**
   * Validar datos de firma
   */
  public validateSignatureData(signatureData: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Verificar que es base64 válido
    try {
      const buffer = Buffer.from(signatureData, 'base64');
      if (buffer.length < 100) {
        errors.push("La firma es demasiado pequeña");
      }
    } catch (error) {
      errors.push("Formato de firma inválido");
    }

    // Verificar longitud mínima
    if (signatureData.length < 500) {
      errors.push("La firma debe ser más detallada");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtener estadísticas de firmas
   */
  public getSignatureStats(): {
    totalRequests: number;
    pendingRequests: number;
    completedSignatures: number;
    expiredRequests: number;
    averageSigningTime: number;
  } {
    const totalRequests = this.signatureRequests.size;
    const now = new Date();
    
    let pendingRequests = 0;
    let expiredRequests = 0;
    
    this.pendingSignatures.forEach((pending) => {
      if (now > pending.expiresAt) {
        expiredRequests++;
      } else {
        pendingRequests++;
      }
    });

    // Contar firmas completadas en todos los documentos
    let completedSignatures = 0;
    Array.from(documentManager['documents'].values()).forEach(doc => {
      completedSignatures += doc.digitalSignatures.length;
    });

    return {
      totalRequests,
      pendingRequests,
      completedSignatures,
      expiredRequests,
      averageSigningTime: 5.5 // minutos promedio (simulado)
    };
  }

  /**
   * Limpiar solicitudes expiradas
   */
  public cleanupExpiredRequests(): number {
    const now = new Date();
    let cleaned = 0;

    this.pendingSignatures.forEach((pending, requestId) => {
      if (now > pending.expiresAt) {
        this.pendingSignatures.delete(requestId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} solicitudes de firma expiradas limpiadas`);
    }

    return cleaned;
  }

  /**
   * Obtener solicitudes pendientes para un usuario
   */
  public getPendingRequestsForUser(userEmail: string): SignatureRequest[] {
    const requests: SignatureRequest[] = [];
    
    this.signatureRequests.forEach((request, requestId) => {
      if (request.signerEmail === userEmail && this.pendingSignatures.has(requestId)) {
        const pending = this.pendingSignatures.get(requestId);
        if (pending && new Date() <= pending.expiresAt) {
          requests.push(request);
        }
      }
    });

    return requests;
  }

  /**
   * Cancelar solicitud de firma
   */
  public cancelSignatureRequest(requestId: string, userId: number): boolean {
    const request = this.signatureRequests.get(requestId);
    
    if (!request || request.requesterUserId !== userId) {
      return false;
    }

    this.pendingSignatures.delete(requestId);
    
    // Agregar evento al documento
    const document = documentManager.getDocument(request.documentId);
    if (document) {
      document.timeline.push({
        id: `event_${Date.now()}`,
        type: 'updated',
        description: `Solicitud de firma cancelada`,
        userId,
        timestamp: new Date()
      });
    }

    console.log(`❌ Solicitud de firma ${requestId} cancelada`);
    return true;
  }
}

// Instancia singleton
export const signatureManager = new SignatureManager();

// Limpiar solicitudes expiradas cada hora
setInterval(() => {
  signatureManager.cleanupExpiredRequests();
}, 60 * 60 * 1000);