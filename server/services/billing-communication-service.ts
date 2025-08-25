/**
 * Billing Communication Service
 * 
 * This service handles billing communication identifiers and processes
 * communication flows related to payment and billing notifications.
 */

import { emailService } from './email-service';
import crypto from 'crypto';

export interface BillingCommunication {
  id: string;
  userId: number;
  paymentId?: string;
  documentId?: string;
  type: 'payment_confirmation' | 'payment_reminder' | 'payment_failed' | 'billing_update' | 'invoice_generated';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  content: string;
  metadata: Record<string, any>;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
}

export interface BillingCommunicationTemplate {
  id: string;
  type: BillingCommunication['type'];
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  isActive: boolean;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class BillingCommunicationService {
  private communications: Map<string, BillingCommunication> = new Map();
  private templates: Map<string, BillingCommunicationTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
    console.log("📧 Servicio de Comunicaciones de Facturación inicializado");
  }

  /**
   * Initialize default billing communication templates
   */
  private initializeTemplates() {
    const defaultTemplates: BillingCommunicationTemplate[] = [
      {
        id: 'payment_confirmation',
        type: 'payment_confirmation',
        name: 'Confirmación de Pago',
        subject: 'Confirmación de Pago - {{documentTitle}}',
        htmlTemplate: this.getPaymentConfirmationTemplate(),
        isActive: true,
        variables: ['userName', 'documentTitle', 'paymentAmount', 'paymentId', 'documentId'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'payment_reminder',
        type: 'payment_reminder',
        name: 'Recordatorio de Pago Pendiente',
        subject: 'Recordatorio: Pago pendiente - {{documentTitle}}',
        htmlTemplate: this.getPaymentReminderTemplate(),
        isActive: true,
        variables: ['userName', 'documentTitle', 'paymentAmount', 'dueDate', 'documentId'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'payment_failed',
        type: 'payment_failed',
        name: 'Pago Rechazado',
        subject: 'Pago rechazado - {{documentTitle}}',
        htmlTemplate: this.getPaymentFailedTemplate(),
        isActive: true,
        variables: ['userName', 'documentTitle', 'paymentAmount', 'failureReason', 'documentId'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Process a billing communication identifier
   */
  public async processBillingCommunicationIdentifier(
    identifier: string,
    context: {
      userId: number;
      paymentId?: string;
      documentId?: string;
      type: BillingCommunication['type'];
      recipientEmail: string;
      recipientName?: string;
      variables: Record<string, any>;
    }
  ): Promise<BillingCommunication> {
    console.log(`📧 Procesando identificador de comunicación de facturación: ${identifier}`);

    // Create billing communication record
    const communication: BillingCommunication = {
      id: identifier,
      userId: context.userId,
      paymentId: context.paymentId,
      documentId: context.documentId,
      type: context.type,
      status: 'pending',
      recipientEmail: context.recipientEmail,
      recipientName: context.recipientName,
      subject: '',
      content: '',
      metadata: {
        originalIdentifier: identifier,
        variables: context.variables,
        processedAt: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    // Get template for communication type
    const template = this.getTemplate(context.type);
    if (!template) {
      throw new Error(`No template found for communication type: ${context.type}`);
    }

    // Generate content from template
    communication.subject = this.processTemplate(template.subject, context.variables);
    communication.content = this.processTemplate(template.htmlTemplate, context.variables);

    // Store communication
    this.communications.set(identifier, communication);

    // Send communication
    await this.sendCommunication(identifier);

    return communication;
  }

  /**
   * Send a billing communication
   */
  public async sendCommunication(communicationId: string): Promise<boolean> {
    const communication = this.communications.get(communicationId);
    if (!communication) {
      console.error(`Comunicación no encontrada: ${communicationId}`);
      return false;
    }

    if (communication.status !== 'pending' && communication.retryCount >= communication.maxRetries) {
      console.error(`Comunicación ${communicationId} ha excedido el número máximo de reintentos`);
      return false;
    }

    try {
      communication.status = 'sent';
      communication.sentAt = new Date();
      communication.updatedAt = new Date();

      // Send email using email service
      const success = await emailService.sendEmail({
        to: communication.recipientEmail,
        subject: communication.subject,
        html: communication.content
      });

      if (success) {
        communication.status = 'delivered';
        communication.deliveredAt = new Date();
        console.log(`✅ Comunicación de facturación ${communicationId} enviada exitosamente`);
      } else {
        throw new Error('Failed to send email');
      }

      return success;
    } catch (error) {
      console.error(`❌ Error enviando comunicación ${communicationId}:`, error);
      
      communication.status = 'failed';
      communication.retryCount++;
      communication.updatedAt = new Date();

      // Schedule retry if within retry limits
      if (communication.retryCount < communication.maxRetries) {
        const retryDelayMinutes = Math.pow(2, communication.retryCount) * 5; // Exponential backoff
        communication.nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
        console.log(`🔄 Comunicación ${communicationId} programada para reintento en ${retryDelayMinutes} minutos`);
      }

      return false;
    }
  }

  /**
   * Get billing communication by ID
   */
  public getCommunication(communicationId: string): BillingCommunication | undefined {
    return this.communications.get(communicationId);
  }

  /**
   * Get communications for a user
   */
  public getUserCommunications(userId: number): BillingCommunication[] {
    return Array.from(this.communications.values())
      .filter(comm => comm.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get template by type
   */
  private getTemplate(type: BillingCommunication['type']): BillingCommunicationTemplate | undefined {
    return this.templates.get(type);
  }

  /**
   * Process template with variables
   */
  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value || ''));
    });

    return processed;
  }

  /**
   * Retry failed communications
   */
  public async retryFailedCommunications(): Promise<number> {
    const now = new Date();
    const toRetry = Array.from(this.communications.values())
      .filter(comm => 
        comm.status === 'failed' &&
        comm.retryCount < comm.maxRetries &&
        comm.nextRetryAt &&
        comm.nextRetryAt <= now
      );

    let retried = 0;
    for (const communication of toRetry) {
      const success = await this.sendCommunication(communication.id);
      if (success) {
        retried++;
      }
    }

    if (retried > 0) {
      console.log(`🔄 ${retried} comunicaciones reintentadas exitosamente`);
    }

    return retried;
  }

  /**
   * Get communication statistics
   */
  public getStatistics(): {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
    bounced: number;
    retryQueue: number;
  } {
    const communications = Array.from(this.communications.values());
    const now = new Date();

    return {
      total: communications.length,
      pending: communications.filter(c => c.status === 'pending').length,
      sent: communications.filter(c => c.status === 'sent').length,
      delivered: communications.filter(c => c.status === 'delivered').length,
      failed: communications.filter(c => c.status === 'failed').length,
      bounced: communications.filter(c => c.status === 'bounced').length,
      retryQueue: communications.filter(c => 
        c.status === 'failed' && 
        c.retryCount < c.maxRetries && 
        c.nextRetryAt && 
        c.nextRetryAt > now
      ).length
    };
  }

  // Template methods
  private getPaymentConfirmationTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #EC1C24; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">NotaryPro</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
          <h2>Confirmación de Pago</h2>
          <p>Estimado/a {{userName}}:</p>
          
          <p>Hemos recibido correctamente el pago por su documento:</p>
          
          <div style="background-color: #f8f8f8; padding: 15px; margin: 15px 0; border-left: 4px solid #EC1C24;">
            <p><strong>Documento:</strong> {{documentTitle}}</p>
            <p><strong>ID de Documento:</strong> {{documentId}}</p>
            <p><strong>Monto:</strong> ${{paymentAmount}} CLP</p>
            <p><strong>ID de Transacción:</strong> {{paymentId}}</p>
            <p><strong>Fecha:</strong> {{currentDate}}</p>
          </div>
          
          <p>Su documento está siendo procesado y le notificaremos cuando esté listo.</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://notarypro.cl/document/{{documentId}}" style="background-color: #EC1C24; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Ver mi documento</a>
          </div>
          
          <p>Atentamente,</p>
          <p><strong>Equipo NotaryPro</strong></p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>© 2025 NotaryPro. Todos los derechos reservados.</p>
        </div>
      </div>
    `;
  }

  private getPaymentReminderTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FF9800; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">NotaryPro</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
          <h2>Recordatorio de Pago Pendiente</h2>
          <p>Estimado/a {{userName}}:</p>
          
          <p>Le recordamos que tiene un pago pendiente para el siguiente documento:</p>
          
          <div style="background-color: #fff3e0; padding: 15px; margin: 15px 0; border-left: 4px solid #FF9800;">
            <p><strong>Documento:</strong> {{documentTitle}}</p>
            <p><strong>ID de Documento:</strong> {{documentId}}</p>
            <p><strong>Monto:</strong> ${{paymentAmount}} CLP</p>
            <p><strong>Fecha límite:</strong> {{dueDate}}</p>
          </div>
          
          <p>Para procesar su documento, necesitamos que complete el pago.</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://notarypro.cl/payment/{{documentId}}" style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Realizar Pago</a>
          </div>
          
          <p>Atentamente,</p>
          <p><strong>Equipo NotaryPro</strong></p>
        </div>
      </div>
    `;
  }

  private getPaymentFailedTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f44336; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">NotaryPro</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
          <h2>Pago Rechazado</h2>
          <p>Estimado/a {{userName}}:</p>
          
          <p>Lamentamos informarle que su pago ha sido rechazado:</p>
          
          <div style="background-color: #ffebee; padding: 15px; margin: 15px 0; border-left: 4px solid #f44336;">
            <p><strong>Documento:</strong> {{documentTitle}}</p>
            <p><strong>ID de Documento:</strong> {{documentId}}</p>
            <p><strong>Monto:</strong> ${{paymentAmount}} CLP</p>
            <p><strong>Motivo:</strong> {{failureReason}}</p>
          </div>
          
          <p>Por favor, revise la información de pago e intente nuevamente.</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://notarypro.cl/payment/{{documentId}}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Intentar Nuevamente</a>
          </div>
          
          <p>Atentamente,</p>
          <p><strong>Equipo NotaryPro</strong></p>
        </div>
      </div>
    `;
  }
}

// Singleton instance
export const billingCommunicationService = new BillingCommunicationService();

// Auto-retry failed communications every 10 minutes
setInterval(async () => {
  await billingCommunicationService.retryFailedCommunications();
}, 10 * 60 * 1000);