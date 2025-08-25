import { documentManager, type Document } from "./document-manager";
import { notaryManager } from "./notary-manager";
import { simpleStorage } from "../simple-storage";
import crypto from "crypto";

export interface PaymentProvider {
  id: string;
  name: string;
  type: 'stripe' | 'paypal' | 'mercadopago' | 'webpay' | 'khipu';
  isActive: boolean;
  supportedCurrencies: string[];
  fees: {
    percentage: number;
    fixedAmount: number;
    currency: string;
  };
  processingTime: string; // "instant", "1-3 days", etc.
  supportedMethods: string[]; // "credit_card", "debit_card", "bank_transfer", etc.
}

export interface PaymentIntent {
  id: string;
  userId: number;
  amount: number;
  currency: string;
  description: string;
  metadata: {
    documentId?: string;
    serviceId?: string;
    appointmentId?: string;
    type: 'document' | 'service' | 'subscription' | 'appointment';
  };
  providerId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  paymentMethod?: string;
  transactionId?: string;
  providerPaymentId?: string;
  failureReason?: string;
  paidAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentHistory {
  id: string;
  paymentIntentId: string;
  action: 'created' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface RefundRequest {
  id: string;
  paymentIntentId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  requestedBy: number;
  processedBy?: number;
  refundTransactionId?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface PaymentReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalTransactions: number;
    totalAmount: number;
    successfulTransactions: number;
    failedTransactions: number;
    refundedTransactions: number;
    averageTransactionAmount: number;
    successRate: number;
  };
  byProvider: Record<string, {
    transactions: number;
    amount: number;
    successRate: number;
  }>;
  byType: Record<string, {
    transactions: number;
    amount: number;
  }>;
  topUsers: {
    userId: number;
    userName: string;
    totalSpent: number;
    transactionCount: number;
  }[];
}

export class PaymentManager {
  private providers: Map<string, PaymentProvider> = new Map();
  private paymentIntents: Map<string, PaymentIntent> = new Map();
  private paymentHistory: Map<string, PaymentHistory[]> = new Map();
  private refundRequests: Map<string, RefundRequest> = new Map();

  constructor() {
    this.initializeProviders();
    console.log("💳 Gestor de Pagos inicializado");
  }

  private initializeProviders() {
    const providers: PaymentProvider[] = [
      {
        id: "stripe",
        name: "Stripe",
        type: "stripe",
        isActive: true,
        supportedCurrencies: ["CLP", "USD", "EUR"],
        fees: { percentage: 3.4, fixedAmount: 300, currency: "CLP" },
        processingTime: "instant",
        supportedMethods: ["credit_card", "debit_card"]
      },
      {
        id: "paypal",
        name: "PayPal",
        type: "paypal",
        isActive: true,
        supportedCurrencies: ["CLP", "USD"],
        fees: { percentage: 4.0, fixedAmount: 0, currency: "CLP" },
        processingTime: "instant",
        supportedMethods: ["paypal_account", "credit_card"]
      },
      {
        id: "mercadopago",
        name: "MercadoPago",
        type: "mercadopago",
        isActive: true,
        supportedCurrencies: ["CLP", "ARS", "USD"],
        fees: { percentage: 2.9, fixedAmount: 200, currency: "CLP" },
        processingTime: "instant",
        supportedMethods: ["credit_card", "debit_card", "bank_transfer"]
      },
      {
        id: "webpay",
        name: "WebPay Plus",
        type: "webpay",
        isActive: true,
        supportedCurrencies: ["CLP"],
        fees: { percentage: 2.5, fixedAmount: 150, currency: "CLP" },
        processingTime: "instant",
        supportedMethods: ["credit_card", "debit_card"]
      }
    ];

    providers.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  // Métodos públicos
  public getAvailableProviders(currency: string = "CLP"): PaymentProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.isActive && p.supportedCurrencies.includes(currency));
  }

  public getProvider(providerId: string): PaymentProvider | undefined {
    return this.providers.get(providerId);
  }

  public calculateTotalAmount(baseAmount: number, providerId: string): {
    baseAmount: number;
    fees: number;
    totalAmount: number;
    provider: PaymentProvider;
  } {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Proveedor de pago ${providerId} no encontrado`);
    }

    const percentageFee = (baseAmount * provider.fees.percentage) / 100;
    const totalFees = percentageFee + provider.fees.fixedAmount;
    const totalAmount = baseAmount + totalFees;

    return {
      baseAmount,
      fees: Math.round(totalFees),
      totalAmount: Math.round(totalAmount),
      provider
    };
  }

  public createPaymentIntent(
    userId: number,
    amount: number,
    currency: string,
    description: string,
    metadata: PaymentIntent['metadata'],
    providerId: string
  ): PaymentIntent {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Proveedor de pago ${providerId} no encontrado`);
    }

    if (!provider.supportedCurrencies.includes(currency)) {
      throw new Error(`Moneda ${currency} no soportada por ${provider.name}`);
    }

    const paymentId = `pay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const paymentIntent: PaymentIntent = {
      id: paymentId,
      userId,
      amount,
      currency,
      description,
      metadata,
      providerId,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.paymentIntents.set(paymentId, paymentIntent);
    this.addPaymentHistory(paymentId, {
      action: 'created',
      description: `Intención de pago creada por ${amount} ${currency}`,
      metadata: { providerId, description }
    });

    console.log(`💳 Intención de pago creada: ${paymentId} por ${amount} ${currency}`);
    return paymentIntent;
  }

  public processPayment(
    paymentId: string,
    paymentMethod: string,
    providerPaymentId: string
  ): boolean {
    const payment = this.paymentIntents.get(paymentId);
    if (!payment) return false;

    if (new Date() > payment.expiresAt) {
      payment.status = 'failed';
      payment.failureReason = 'Payment expired';
      this.addPaymentHistory(paymentId, {
        action: 'failed',
        description: 'Pago expirado'
      });
      return false;
    }

    // Simular procesamiento
    payment.status = 'processing';
    payment.paymentMethod = paymentMethod;
    payment.providerPaymentId = providerPaymentId;
    payment.updatedAt = new Date();

    this.addPaymentHistory(paymentId, {
      action: 'processing',
      description: `Procesando pago con ${paymentMethod}`,
      metadata: { providerPaymentId }
    });

    // Simular éxito después de un delay
    setTimeout(() => {
      this.completePayment(paymentId, `txn_${Date.now()}`);
    }, 2000);

    return true;
  }

  public completePayment(paymentId: string, transactionId: string): boolean {
    const payment = this.paymentIntents.get(paymentId);
    if (!payment) return false;

    payment.status = 'completed';
    payment.transactionId = transactionId;
    payment.paidAt = new Date();
    payment.updatedAt = new Date();

    this.addPaymentHistory(paymentId, {
      action: 'completed',
      description: 'Pago completado exitosamente',
      metadata: { transactionId }
    });

    // Actualizar documento relacionado si existe
    if (payment.metadata.documentId) {
      const document = documentManager.getDocument(payment.metadata.documentId);
      if (document) {
        document.paymentInfo = {
          paymentId,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.providerId as any,
          status: 'completed',
          transactionId,
          paidAt: payment.paidAt
        };

        documentManager.updateDocumentStatus(
          payment.metadata.documentId,
          'pending_identity',
          'Pago completado, esperando verificación de identidad'
        );
      }
    }

    console.log(`✅ Pago ${paymentId} completado exitosamente`);
    return true;
  }

  public failPayment(paymentId: string, reason: string): boolean {
    const payment = this.paymentIntents.get(paymentId);
    if (!payment) return false;

    payment.status = 'failed';
    payment.failureReason = reason;
    payment.updatedAt = new Date();

    this.addPaymentHistory(paymentId, {
      action: 'failed',
      description: `Pago falló: ${reason}`
    });

    console.log(`❌ Pago ${paymentId} falló: ${reason}`);
    return true;
  }

  public getPaymentIntent(paymentId: string): PaymentIntent | undefined {
    return this.paymentIntents.get(paymentId);
  }

  public getUserPayments(userId: number): PaymentIntent[] {
    return Array.from(this.paymentIntents.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getPaymentHistory(paymentId: string): PaymentHistory[] {
    return this.paymentHistory.get(paymentId) || [];
  }

  private addPaymentHistory(paymentId: string, event: Omit<PaymentHistory, 'id' | 'paymentIntentId' | 'timestamp'>) {
    const historyId = `hist_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const historyEvent: PaymentHistory = {
      ...event,
      id: historyId,
      paymentIntentId: paymentId,
      timestamp: new Date()
    };

    const existing = this.paymentHistory.get(paymentId) || [];
    existing.push(historyEvent);
    this.paymentHistory.set(paymentId, existing);
  }

  // Métodos de reembolso
  public requestRefund(
    paymentId: string,
    amount: number,
    reason: string,
    requestedBy: number
  ): string {
    const payment = this.getPaymentIntent(paymentId);
    if (!payment || payment.status !== 'completed') {
      throw new Error("Pago no válido para reembolso");
    }

    if (amount > payment.amount) {
      throw new Error("Monto de reembolso excede el pago original");
    }

    const refundId = `ref_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const refundRequest: RefundRequest = {
      id: refundId,
      paymentIntentId: paymentId,
      amount,
      reason,
      status: 'pending',
      requestedBy,
      createdAt: new Date()
    };

    this.refundRequests.set(refundId, refundRequest);

    console.log(`🔄 Solicitud de reembolso creada: ${refundId} por ${amount} ${payment.currency}`);
    return refundId;
  }

  public processRefund(refundId: string, processedBy: number): boolean {
    const refund = this.refundRequests.get(refundId);
    if (!refund || refund.status !== 'pending') return false;

    const payment = this.getPaymentIntent(refund.paymentIntentId);
    if (!payment) return false;

    // Simular procesamiento de reembolso
    refund.status = 'completed';
    refund.processedBy = processedBy;
    refund.processedAt = new Date();
    refund.refundTransactionId = `ref_txn_${Date.now()}`;

    // Actualizar estado del pago original
    payment.status = 'refunded';
    payment.updatedAt = new Date();

    this.addPaymentHistory(payment.id, {
      action: 'refunded',
      description: `Reembolso procesado: ${refund.amount} ${payment.currency}`,
      metadata: { refundId, refundTransactionId: refund.refundTransactionId }
    });

    console.log(`💰 Reembolso ${refundId} procesado exitosamente`);
    return true;
  }

  // Métodos de estadísticas y reportes
  public getPaymentStats(userId?: number): {
    totalTransactions: number;
    totalAmount: number;
    successfulTransactions: number;
    failedTransactions: number;
    refundedTransactions: number;
    averageAmount: number;
    successRate: number;
    totalRefunds: number;
    refundAmount: number;
  } {
    let payments = Array.from(this.paymentIntents.values());
    
    if (userId) {
      payments = payments.filter(p => p.userId === userId);
    }

    const successful = payments.filter(p => p.status === 'completed');
    const failed = payments.filter(p => p.status === 'failed');
    const refunded = payments.filter(p => p.status === 'refunded');
    
    const totalAmount = successful.reduce((sum, p) => sum + p.amount, 0);
    const refundAmount = refunded.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalTransactions: payments.length,
      totalAmount,
      successfulTransactions: successful.length,
      failedTransactions: failed.length,
      refundedTransactions: refunded.length,
      averageAmount: payments.length > 0 ? totalAmount / successful.length : 0,
      successRate: payments.length > 0 ? (successful.length / payments.length) * 100 : 0,
      totalRefunds: refunded.length,
      refundAmount
    };
  }

  public generatePaymentReport(startDate: Date, endDate: Date): PaymentReport {
    const payments = Array.from(this.paymentIntents.values())
      .filter(p => p.createdAt >= startDate && p.createdAt <= endDate);

    const successful = payments.filter(p => p.status === 'completed');
    const failed = payments.filter(p => p.status === 'failed');
    const refunded = payments.filter(p => p.status === 'refunded');

    // Estadísticas por proveedor
    const byProvider: Record<string, { transactions: number; amount: number; successRate: number }> = {};
    this.providers.forEach((provider, id) => {
      const providerPayments = payments.filter(p => p.providerId === id);
      const providerSuccessful = providerPayments.filter(p => p.status === 'completed');
      
      byProvider[provider.name] = {
        transactions: providerPayments.length,
        amount: providerSuccessful.reduce((sum, p) => sum + p.amount, 0),
        successRate: providerPayments.length > 0 ? (providerSuccessful.length / providerPayments.length) * 100 : 0
      };
    });

    // Estadísticas por tipo
    const byType: Record<string, { transactions: number; amount: number }> = {};
    payments.forEach(payment => {
      const type = payment.metadata.type;
      if (!byType[type]) {
        byType[type] = { transactions: 0, amount: 0 };
      }
      byType[type].transactions++;
      if (payment.status === 'completed') {
        byType[type].amount += payment.amount;
      }
    });

    // Top usuarios
    const userSpending: Record<number, { amount: number; transactions: number }> = {};
    successful.forEach(payment => {
      if (!userSpending[payment.userId]) {
        userSpending[payment.userId] = { amount: 0, transactions: 0 };
      }
      userSpending[payment.userId].amount += payment.amount;
      userSpending[payment.userId].transactions++;
    });

    const topUsers = Object.entries(userSpending)
      .map(([userId, data]) => {
        const user = simpleStorage.findUserById(parseInt(userId));
        return {
          userId: parseInt(userId),
          userName: user?.fullName || `Usuario ${userId}`,
          totalSpent: data.amount,
          transactionCount: data.transactions
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalTransactions: payments.length,
        totalAmount: successful.reduce((sum, p) => sum + p.amount, 0),
        successfulTransactions: successful.length,
        failedTransactions: failed.length,
        refundedTransactions: refunded.length,
        averageAmount: successful.length > 0 ? successful.reduce((sum, p) => sum + p.amount, 0) / successful.length : 0,
        successRate: payments.length > 0 ? (successful.length / payments.length) * 100 : 0,
        totalRefunds: refunded.length,
        refundAmount: refunded.reduce((sum, p) => sum + p.amount, 0)
      },
      byProvider,
      byType,
      topUsers
    };
  }

  // Métodos de integración con otros módulos
  public createDocumentPayment(documentId: string, userId: number, providerId: string): PaymentIntent {
    const document = documentManager.getDocument(documentId);
    if (!document) {
      throw new Error("Documento no encontrado");
    }

    const template = documentManager.getTemplate(document.templateId);
    if (!template) {
      throw new Error("Plantilla de documento no encontrada");
    }

    return this.createPaymentIntent(
      userId,
      template.price,
      "CLP",
      `Pago por ${template.name}`,
      {
        documentId,
        type: 'document'
      },
      providerId
    );
  }

  public createServicePayment(
    serviceId: string,
    userId: number,
    providerId: string,
    variables?: { pages?: number; signatures?: number; hours?: number }
  ): PaymentIntent {
    const totalFee = notaryManager.calculateServiceFee(serviceId, variables);
    const service = notaryManager.getServiceById(serviceId);
    
    if (!service) {
      throw new Error("Servicio no encontrado");
    }

    return this.createPaymentIntent(
      userId,
      totalFee,
      "CLP",
      `Pago por ${service.serviceName}`,
      {
        serviceId,
        type: 'service'
      },
      providerId
    );
  }

  // Métodos de webhook (simulados)
  public handleWebhook(providerId: string, payload: any): boolean {
    try {
      // Simulación de manejo de webhook
      console.log(`🔔 Webhook recibido de ${providerId}:`, payload);
      
      // En una implementación real, aquí se procesarían los eventos
      // del proveedor de pagos (confirmaciones, fallos, etc.)
      
      return true;
    } catch (error) {
      console.error(`❌ Error procesando webhook de ${providerId}:`, error);
      return false;
    }
  }

  // Métodos de búsqueda y filtrado
  public searchPayments(query: string, filters?: {
    status?: PaymentIntent['status'];
    providerId?: string;
    startDate?: Date;
    endDate?: Date;
    userId?: number;
  }): PaymentIntent[] {
    let payments = Array.from(this.paymentIntents.values());

    // Aplicar filtros
    if (filters) {
      if (filters.status) {
        payments = payments.filter(p => p.status === filters.status);
      }
      
      if (filters.providerId) {
        payments = payments.filter(p => p.providerId === filters.providerId);
      }
      
      if (filters.startDate) {
        payments = payments.filter(p => p.createdAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        payments = payments.filter(p => p.createdAt <= filters.endDate!);
      }
      
      if (filters.userId) {
        payments = payments.filter(p => p.userId === filters.userId);
      }
    }

    // Filtro por texto
    if (query) {
      payments = payments.filter(p =>
        p.description.toLowerCase().includes(query.toLowerCase()) ||
        p.id.toLowerCase().includes(query.toLowerCase()) ||
        (p.transactionId && p.transactionId.toLowerCase().includes(query.toLowerCase()))
      );
    }

    return payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getPendingPayments(): PaymentIntent[] {
    const now = new Date();
    return Array.from(this.paymentIntents.values())
      .filter(p => p.status === 'pending' && p.expiresAt > now);
  }

  public getExpiredPayments(): PaymentIntent[] {
    const now = new Date();
    return Array.from(this.paymentIntents.values())
      .filter(p => p.status === 'pending' && p.expiresAt <= now);
  }

  // Limpieza automática
  public cleanupExpiredPayments(): number {
    const expiredPayments = this.getExpiredPayments();
    let cleaned = 0;

    expiredPayments.forEach(payment => {
      payment.status = 'failed';
      payment.failureReason = 'Payment expired';
      payment.updatedAt = new Date();
      
      this.addPaymentHistory(payment.id, {
        action: 'failed',
        description: 'Pago expirado automáticamente'
      });
      
      cleaned++;
    });

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} pagos expirados limpiados`);
    }

    return cleaned;
  }
}

// Instancia singleton
export const paymentManager = new PaymentManager();

// Limpiar pagos expirados cada 30 minutos
setInterval(() => {
  paymentManager.cleanupExpiredPayments();
}, 30 * 60 * 1000);