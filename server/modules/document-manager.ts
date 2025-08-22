import { simpleStorage, type SimpleUser } from "../simple-storage";
import { generateRandomPassword } from "../simple-auth";
import fs from "fs/promises";
import path from "path";

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  htmlTemplate: string;
  formFields: FormField[];
  price: number;
  estimatedTime: number; // minutos
  requiredDocuments: string[];
  legalRequirements: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'file';
  required: boolean;
  placeholder?: string;
  options?: string[]; // Para select
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface Document {
  id: string;
  templateId: string;
  userId: number;
  title: string;
  status: 'draft' | 'pending_payment' | 'pending_identity' | 'pending_signature' | 'pending_notarization' | 'completed' | 'rejected';
  formData: Record<string, any>;
  generatedHtml?: string;
  pdfPath?: string;
  qrCode?: string;
  digitalSignatures: DigitalSignature[];
  notaryInfo?: NotaryInfo;
  paymentInfo?: PaymentInfo;
  timeline: DocumentEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DigitalSignature {
  id: string;
  signerName: string;
  signerEmail: string;
  signatureData: string; // Base64 signature image
  timestamp: Date;
  ipAddress: string;
  verified: boolean;
  certificateInfo?: {
    issuer: string;
    validFrom: Date;
    validTo: Date;
  };
}

export interface NotaryInfo {
  notaryId: number;
  notaryName: string;
  licenseNumber: string;
  jurisdiction: string;
  sealApplied: boolean;
  notarizationDate: Date;
  witnessCount: number;
}

export interface PaymentInfo {
  paymentId: string;
  amount: number;
  currency: string;
  method: 'stripe' | 'paypal' | 'mercadopago';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  paidAt?: Date;
}

export interface DocumentEvent {
  id: string;
  type: 'created' | 'updated' | 'payment_completed' | 'identity_verified' | 'signed' | 'notarized' | 'completed' | 'rejected';
  description: string;
  userId?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class DocumentManager {
  private templates: Map<string, DocumentTemplate> = new Map();
  private documents: Map<string, Document> = new Map();
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), "uploads");
    this.initializeTemplates();
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      console.error("Error creando directorio uploads:", error);
    }
  }

  private initializeTemplates() {
    // Plantilla de Contrato de Arrendamiento
    const rentalContract: DocumentTemplate = {
      id: "rental_contract",
      name: "Contrato de Arrendamiento",
      description: "Contrato estándar para arrendamiento de vivienda",
      category: "Contratos",
      htmlTemplate: this.getRentalContractTemplate(),
      formFields: [
        {
          id: "landlord_name",
          name: "landlordName",
          label: "Nombre del Arrendador",
          type: "text",
          required: true,
          validation: { minLength: 2, maxLength: 100 }
        },
        {
          id: "landlord_rut",
          name: "landlordRut",
          label: "RUT del Arrendador",
          type: "text",
          required: true,
          placeholder: "12.345.678-9"
        },
        {
          id: "tenant_name",
          name: "tenantName",
          label: "Nombre del Arrendatario",
          type: "text",
          required: true,
          validation: { minLength: 2, maxLength: 100 }
        },
        {
          id: "tenant_rut",
          name: "tenantRut",
          label: "RUT del Arrendatario",
          type: "text",
          required: true,
          placeholder: "12.345.678-9"
        },
        {
          id: "property_address",
          name: "propertyAddress",
          label: "Dirección de la Propiedad",
          type: "textarea",
          required: true,
          validation: { minLength: 10, maxLength: 500 }
        },
        {
          id: "monthly_rent",
          name: "monthlyRent",
          label: "Renta Mensual (CLP)",
          type: "number",
          required: true,
          validation: { min: 1000, max: 10000000 }
        },
        {
          id: "contract_start",
          name: "contractStart",
          label: "Fecha de Inicio",
          type: "date",
          required: true
        },
        {
          id: "contract_duration",
          name: "contractDuration",
          label: "Duración (meses)",
          type: "select",
          required: true,
          options: ["6", "12", "18", "24", "36"]
        }
      ],
      price: 15000, // CLP
      estimatedTime: 30,
      requiredDocuments: ["Cédula de Identidad", "Certificado de Ingresos"],
      legalRequirements: ["Firma ante notario", "Timbre fiscal"],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    // Plantilla de Poder Notarial
    const powerOfAttorney: DocumentTemplate = {
      id: "power_of_attorney",
      name: "Poder Notarial",
      description: "Poder general para representación legal",
      category: "Poderes",
      htmlTemplate: this.getPowerOfAttorneyTemplate(),
      formFields: [
        {
          id: "grantor_name",
          name: "grantorName",
          label: "Nombre del Otorgante",
          type: "text",
          required: true
        },
        {
          id: "grantor_rut",
          name: "grantorRut",
          label: "RUT del Otorgante",
          type: "text",
          required: true
        },
        {
          id: "attorney_name",
          name: "attorneyName",
          label: "Nombre del Apoderado",
          type: "text",
          required: true
        },
        {
          id: "attorney_rut",
          name: "attorneyRut",
          label: "RUT del Apoderado",
          type: "text",
          required: true
        },
        {
          id: "power_scope",
          name: "powerScope",
          label: "Alcance del Poder",
          type: "select",
          required: true,
          options: ["General", "Específico para Bienes Raíces", "Específico para Vehículos", "Específico para Trámites Bancarios"]
        },
        {
          id: "specific_powers",
          name: "specificPowers",
          label: "Poderes Específicos",
          type: "textarea",
          required: false,
          placeholder: "Detalle los poderes específicos si aplica"
        }
      ],
      price: 25000,
      estimatedTime: 45,
      requiredDocuments: ["Cédula de Identidad del Otorgante", "Cédula de Identidad del Apoderado"],
      legalRequirements: ["Firma ante notario", "Dos testigos"],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    this.templates.set(rentalContract.id, rentalContract);
    this.templates.set(powerOfAttorney.id, powerOfAttorney);
  }

  // Métodos públicos
  public getAllTemplates(): DocumentTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.isActive);
  }

  public getTemplate(id: string): DocumentTemplate | undefined {
    return this.templates.get(id);
  }

  public getTemplatesByCategory(category: string): DocumentTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  public createDocument(templateId: string, userId: number, formData: Record<string, any>): Document {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Plantilla ${templateId} no encontrada`);
    }

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const document: Document = {
      id: documentId,
      templateId,
      userId,
      title: `${template.name} - ${new Date().toLocaleDateString()}`,
      status: 'draft',
      formData,
      digitalSignatures: [],
      timeline: [{
        id: `event_${Date.now()}`,
        type: 'created',
        description: 'Documento creado',
        userId,
        timestamp: new Date()
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.documents.set(documentId, document);
    return document;
  }

  public getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }

  public getUserDocuments(userId: number): Document[] {
    return Array.from(this.documents.values()).filter(d => d.userId === userId);
  }

  public updateDocumentStatus(documentId: string, status: Document['status'], description?: string): Document | undefined {
    const document = this.documents.get(documentId);
    if (!document) return undefined;

    document.status = status;
    document.updatedAt = new Date();
    
    // Agregar evento al timeline
    document.timeline.push({
      id: `event_${Date.now()}`,
      type: status === 'completed' ? 'completed' : 'updated',
      description: description || `Estado cambiado a ${status}`,
      timestamp: new Date()
    });

    return document;
  }

  public generateDocumentHtml(documentId: string): string | undefined {
    const document = this.documents.get(documentId);
    if (!document) return undefined;

    const template = this.getTemplate(document.templateId);
    if (!template) return undefined;

    let html = template.htmlTemplate;
    
    // Reemplazar placeholders con datos del formulario
    Object.entries(document.formData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(placeholder, 'g'), String(value));
    });

    // Agregar metadatos del documento
    html = html.replace('{{document_id}}', document.id);
    html = html.replace('{{creation_date}}', document.createdAt.toLocaleDateString('es-CL'));
    html = html.replace('{{document_status}}', document.status);

    document.generatedHtml = html;
    this.documents.set(documentId, document);

    return html;
  }

  public addDigitalSignature(documentId: string, signature: Omit<DigitalSignature, 'id' | 'timestamp' | 'verified'>): boolean {
    const document = this.documents.get(documentId);
    if (!document) return false;

    const digitalSignature: DigitalSignature = {
      ...signature,
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      verified: true // En desarrollo, auto-verificar
    };

    document.digitalSignatures.push(digitalSignature);
    document.timeline.push({
      id: `event_${Date.now()}`,
      type: 'signed',
      description: `Documento firmado por ${signature.signerName}`,
      timestamp: new Date()
    });

    // Si tiene todas las firmas necesarias, cambiar estado
    if (document.digitalSignatures.length >= 1) {
      document.status = 'pending_notarization';
    }

    document.updatedAt = new Date();
    return true;
  }

  public getDocumentStats(): {
    total: number;
    byStatus: Record<string, number>;
    byTemplate: Record<string, number>;
    recentDocuments: Document[];
  } {
    const documents = Array.from(this.documents.values());
    
    const byStatus: Record<string, number> = {};
    const byTemplate: Record<string, number> = {};

    documents.forEach(doc => {
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
      
      const template = this.getTemplate(doc.templateId);
      const templateName = template?.name || doc.templateId;
      byTemplate[templateName] = (byTemplate[templateName] || 0) + 1;
    });

    const recentDocuments = documents
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      total: documents.length,
      byStatus,
      byTemplate,
      recentDocuments
    };
  }

  // Plantillas HTML
  private getRentalContractTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Contrato de Arrendamiento</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
        .signature-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; }
        .metadata { font-size: 10px; color: #666; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CONTRATO DE ARRENDAMIENTO</h1>
        <p><strong>Documento ID:</strong> {{document_id}}</p>
        <p><strong>Fecha de Creación:</strong> {{creation_date}}</p>
    </div>
    
    <div class="section">
        <p>En la ciudad de Santiago, a {{creation_date}}, entre:</p>
        
        <p><strong>ARRENDADOR:</strong> {{landlordName}}, RUT {{landlordRut}}, en adelante "EL ARRENDADOR"</p>
        
        <p><strong>ARRENDATARIO:</strong> {{tenantName}}, RUT {{tenantRut}}, en adelante "EL ARRENDATARIO"</p>
    </div>
    
    <div class="section">
        <h3>PRIMERA: OBJETO DEL CONTRATO</h3>
        <p>EL ARRENDADOR da en arrendamiento a EL ARRENDATARIO la propiedad ubicada en:</p>
        <p><strong>{{propertyAddress}}</strong></p>
    </div>
    
    <div class="section">
        <h3>SEGUNDA: RENTA</h3>
        <p>La renta mensual es de <strong>${{monthlyRent}} pesos chilenos</strong>, pagadera dentro de los primeros 5 días de cada mes.</p>
    </div>
    
    <div class="section">
        <h3>TERCERA: PLAZO</h3>
        <p>El presente contrato tendrá una duración de <strong>{{contractDuration}} meses</strong>, comenzando el {{contractStart}}.</p>
    </div>
    
    <div class="section">
        <h3>CUARTA: OBLIGACIONES</h3>
        <p>EL ARRENDATARIO se obliga a:</p>
        <ul>
            <li>Pagar la renta en la fecha convenida</li>
            <li>Mantener la propiedad en buen estado</li>
            <li>No subarrendar sin autorización escrita</li>
            <li>Cumplir con las normas de convivencia</li>
        </ul>
    </div>
    
    <div class="signature-section">
        <div class="signature-box">
            <p>{{landlordName}}<br>ARRENDADOR</p>
        </div>
        <div class="signature-box">
            <p>{{tenantName}}<br>ARRENDATARIO</p>
        </div>
    </div>
    
    <div class="metadata">
        <p>Documento generado por DocuSignPro | Estado: {{document_status}} | ID: {{document_id}}</p>
    </div>
</body>
</html>`;
  }

  private getPowerOfAttorneyTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Poder Notarial</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
        .signature-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; }
        .notary-section { border: 2px solid #000; padding: 20px; margin-top: 30px; }
        .metadata { font-size: 10px; color: #666; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PODER NOTARIAL</h1>
        <p><strong>Documento ID:</strong> {{document_id}}</p>
        <p><strong>Fecha de Otorgamiento:</strong> {{creation_date}}</p>
    </div>
    
    <div class="section">
        <p>Yo, <strong>{{grantorName}}</strong>, RUT <strong>{{grantorRut}}</strong>, por el presente instrumento otorgo poder a:</p>
        
        <p><strong>{{attorneyName}}</strong>, RUT <strong>{{attorneyRut}}</strong></p>
    </div>
    
    <div class="section">
        <h3>FACULTADES OTORGADAS</h3>
        <p><strong>Alcance:</strong> {{powerScope}}</p>
        {{#if specificPowers}}
        <p><strong>Poderes Específicos:</strong></p>
        <p>{{specificPowers}}</p>
        {{/if}}
        
        <p>Para que en mi nombre y representación pueda:</p>
        <ul>
            <li>Comparecer ante toda clase de autoridades</li>
            <li>Celebrar contratos y convenios</li>
            <li>Cobrar y percibir dineros</li>
            <li>Otorgar recibos y finiquitos</li>
            <li>En general, ejecutar todos los actos necesarios</li>
        </ul>
    </div>
    
    <div class="signature-section">
        <div class="signature-box">
            <p>{{grantorName}}<br>OTORGANTE</p>
        </div>
        <div class="signature-box">
            <p>{{attorneyName}}<br>APODERADO</p>
        </div>
    </div>
    
    <div class="notary-section">
        <h4>CERTIFICACIÓN NOTARIAL</h4>
        <p>Certifico que las firmas que anteceden son auténticas...</p>
        <br><br>
        <div style="text-align: center;">
            <div class="signature-box" style="margin: 0 auto;">
                <p>NOTARIO PÚBLICO</p>
            </div>
        </div>
    </div>
    
    <div class="metadata">
        <p>Documento generado por DocuSignPro | Estado: {{document_status}} | ID: {{document_id}}</p>
    </div>
</body>
</html>`;
  }

  // Métodos de búsqueda y filtrado
  public searchDocuments(query: string, userId?: number): Document[] {
    const documents = userId 
      ? this.getUserDocuments(userId)
      : Array.from(this.documents.values());

    return documents.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.id.toLowerCase().includes(query.toLowerCase()) ||
      this.getTemplate(doc.templateId)?.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  public getDocumentsByStatus(status: Document['status'], userId?: number): Document[] {
    const documents = userId 
      ? this.getUserDocuments(userId)
      : Array.from(this.documents.values());

    return documents.filter(doc => doc.status === status);
  }

  public getDocumentHistory(documentId: string): DocumentEvent[] {
    const document = this.getDocument(documentId);
    return document?.timeline || [];
  }
}

// Instancia singleton
export const documentManager = new DocumentManager();