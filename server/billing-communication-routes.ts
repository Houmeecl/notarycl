/**
 * Billing Communication API Routes
 * 
 * Handles API endpoints for billing communication processing
 */

import { Router, Request, Response } from "express";
import { billingCommunicationService } from "./services/billing-communication-service";
import { paymentManager } from "./modules/payment-manager";

export const billingCommunicationRouter = Router();

/**
 * Process a billing communication identifier
 * POST /api/billing-communication/process
 */
billingCommunicationRouter.post('/process', async (req: Request, res: Response) => {
  try {
    const { 
      identifier, 
      userId, 
      paymentId, 
      documentId, 
      type, 
      recipientEmail, 
      recipientName, 
      variables 
    } = req.body;

    // Validate required fields
    if (!identifier || !userId || !type || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren los campos: identifier, userId, type, recipientEmail'
      });
    }

    // Validate communication type
    const validTypes = ['payment_confirmation', 'payment_reminder', 'payment_failed', 'billing_update', 'invoice_generated'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Tipo de comunicación inválido. Tipos válidos: ${validTypes.join(', ')}`
      });
    }

    // Process the billing communication identifier
    const communication = await billingCommunicationService.processBillingCommunicationIdentifier(
      identifier,
      {
        userId,
        paymentId,
        documentId,
        type,
        recipientEmail,
        recipientName,
        variables: {
          ...variables,
          currentDate: new Date().toLocaleString('es-CL')
        }
      }
    );

    res.json({
      success: true,
      message: 'Comunicación de facturación procesada exitosamente',
      data: {
        communicationId: communication.id,
        status: communication.status,
        sentAt: communication.sentAt,
        recipientEmail: communication.recipientEmail
      }
    });

  } catch (error) {
    console.error('Error procesando comunicación de facturación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process the specific billing communication identifier from the request
 * POST /api/billing-communication/process/bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4
 */
billingCommunicationRouter.post('/process/bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4', async (req: Request, res: Response) => {
  try {
    const identifier = 'bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4';
    const { 
      userId, 
      paymentId, 
      documentId, 
      type = 'payment_confirmation',
      recipientEmail, 
      recipientName,
      variables = {}
    } = req.body;

    // Validate required fields
    if (!userId || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren los campos: userId, recipientEmail'
      });
    }

    // If paymentId is provided, get payment details
    let paymentDetails = null;
    if (paymentId) {
      paymentDetails = paymentManager.getPaymentIntent(paymentId);
      if (!paymentDetails) {
        return res.status(404).json({
          success: false,
          message: `Pago no encontrado: ${paymentId}`
        });
      }
    }

    // Prepare variables with payment details if available
    const templateVariables = {
      userName: recipientName || 'Usuario',
      documentTitle: variables.documentTitle || 'Documento',
      documentId: documentId || 'N/A',
      paymentAmount: paymentDetails?.amount || variables.paymentAmount || 0,
      paymentId: paymentId || 'N/A',
      currentDate: new Date().toLocaleString('es-CL'),
      ...variables
    };

    // Process the billing communication
    const communication = await billingCommunicationService.processBillingCommunicationIdentifier(
      identifier,
      {
        userId,
        paymentId,
        documentId,
        type: type as any,
        recipientEmail,
        recipientName,
        variables: templateVariables
      }
    );

    res.json({
      success: true,
      message: `Comunicación de facturación ${identifier} procesada exitosamente`,
      data: {
        communicationId: communication.id,
        status: communication.status,
        type: communication.type,
        recipientEmail: communication.recipientEmail,
        sentAt: communication.sentAt,
        deliveredAt: communication.deliveredAt,
        paymentDetails: paymentDetails ? {
          id: paymentDetails.id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          status: paymentDetails.status
        } : null
      }
    });

  } catch (error) {
    console.error(`Error procesando comunicación bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get billing communication by ID
 * GET /api/billing-communication/:id
 */
billingCommunicationRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const communication = billingCommunicationService.getCommunication(id);
    
    if (!communication) {
      return res.status(404).json({
        success: false,
        message: 'Comunicación no encontrada'
      });
    }

    res.json({
      success: true,
      data: communication
    });

  } catch (error) {
    console.error('Error obteniendo comunicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Get user's billing communications
 * GET /api/billing-communication/user/:userId
 */
billingCommunicationRouter.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const communications = billingCommunicationService.getUserCommunications(parseInt(userId));
    
    res.json({
      success: true,
      data: communications,
      count: communications.length
    });

  } catch (error) {
    console.error('Error obteniendo comunicaciones del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Retry a failed communication
 * POST /api/billing-communication/:id/retry
 */
billingCommunicationRouter.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const communication = billingCommunicationService.getCommunication(id);
    if (!communication) {
      return res.status(404).json({
        success: false,
        message: 'Comunicación no encontrada'
      });
    }

    if (communication.status !== 'failed') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden reintentar comunicaciones fallidas'
      });
    }

    const success = await billingCommunicationService.sendCommunication(id);
    
    res.json({
      success,
      message: success ? 'Comunicación reenviada exitosamente' : 'Error al reenviar comunicación',
      data: {
        communicationId: id,
        status: communication.status,
        retryCount: communication.retryCount
      }
    });

  } catch (error) {
    console.error('Error reintentando comunicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Get billing communication statistics
 * GET /api/billing-communication/stats
 */
billingCommunicationRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = billingCommunicationService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Test endpoint for the specific identifier
 * GET /api/billing-communication/test/bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4
 */
billingCommunicationRouter.get('/test/bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4', async (req: Request, res: Response) => {
  try {
    const identifier = 'bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4';
    
    // Check if communication exists
    const existingComm = billingCommunicationService.getCommunication(identifier);
    
    res.json({
      success: true,
      message: `Estado del identificador de comunicación de facturación: ${identifier}`,
      data: {
        identifier,
        exists: !!existingComm,
        status: existingComm?.status || 'not_found',
        created: existingComm?.createdAt || null,
        lastUpdate: existingComm?.updatedAt || null,
        recipient: existingComm?.recipientEmail || null,
        type: existingComm?.type || null,
        retryCount: existingComm?.retryCount || 0
      }
    });

  } catch (error) {
    console.error('Error en test de comunicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});