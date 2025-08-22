import { documentManager, type Document, type NotaryInfo } from "./document-manager";
import { simpleStorage, type SimpleUser } from "../simple-storage";
import crypto from "crypto";

export interface NotaryProfile {
  id: number;
  userId: number;
  registryNumber: string;
  licenseNumber: string;
  jurisdiction: string;
  specializations: string[];
  officeAddress: string;
  officePhone: string;
  officeEmail: string;
  website?: string;
  bio: string;
  serviceArea: string[];
  isActive: boolean;
  digitalSealId: string;
  digitalSealExpiry: Date;
  profileImageUrl?: string;
  verificationStatus: 'pending' | 'verified' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface NotaryAppointment {
  id: string;
  notaryId: number;
  clientId: number;
  documentId?: string;
  serviceType: 'document_notarization' | 'identity_verification' | 'signature_witnessing' | 'oath_administration' | 'copy_certification';
  appointmentDate: Date;
  duration: number; // minutos
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  location: 'office' | 'client_location' | 'remote';
  clientLocationAddress?: string;
  meetingUrl?: string;
  notes?: string;
  feeEstimate: number;
  actualFee?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotaryService {
  id: string;
  notaryId: number;
  serviceType: string;
  serviceName: string;
  description: string;
  basePrice: number;
  variableRate?: number; // por página, por firma, etc.
  variableFactor?: string; // "per_page", "per_signature", "per_hour"
  estimatedDuration: number; // minutos
  requiresAppointment: boolean;
  availableRemotely: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotarizationRecord {
  id: string;
  notaryId: number;
  documentId: string;
  clientId: number;
  serviceType: string;
  notarizationDate: Date;
  location: string;
  witnessCount: number;
  witnessNames?: string[];
  sealApplied: boolean;
  digitalSealHash: string;
  certificateNumber: string;
  notes?: string;
  fee: number;
  paymentStatus: 'pending' | 'completed';
  createdAt: Date;
}

export interface NotaryAvailability {
  notaryId: number;
  dayOfWeek: number; // 0-6 (domingo-sábado)
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  isAvailable: boolean;
  maxAppointments: number;
  breakStartTime?: string;
  breakEndTime?: string;
}

export class NotaryManager {
  private notaryProfiles: Map<number, NotaryProfile> = new Map();
  private appointments: Map<string, NotaryAppointment> = new Map();
  private services: Map<string, NotaryService> = new Map();
  private notarizationRecords: Map<string, NotarizationRecord> = new Map();
  private availability: Map<number, NotaryAvailability[]> = new Map();

  constructor() {
    this.initializeTestNotaries();
    this.initializeServices();
    console.log("⚖️ Gestor de Servicios Notariales inicializado");
  }

  private initializeTestNotaries() {
    // Crear notario de prueba
    const testNotary: NotaryProfile = {
      id: 1,
      userId: 1, // Asociado al admin
      registryNumber: "NOT-2024-001",
      licenseNumber: "LIC-12345-CL",
      jurisdiction: "Región Metropolitana, Chile",
      specializations: [
        "Contratos Inmobiliarios",
        "Poderes Notariales",
        "Constitución de Sociedades",
        "Testamentos",
        "Escrituras Públicas"
      ],
      officeAddress: "Av. Providencia 1234, Oficina 567, Providencia, Santiago",
      officePhone: "+56 2 2234 5678",
      officeEmail: "notario@docusignpro.com",
      website: "https://notario.docusignpro.com",
      bio: "Notario Público con más de 15 años de experiencia en derecho civil y comercial. Especialista en transacciones inmobiliarias y constitución de empresas.",
      serviceArea: ["Santiago", "Providencia", "Las Condes", "Vitacura", "Ñuñoa"],
      isActive: true,
      digitalSealId: `seal_${crypto.randomBytes(16).toString('hex')}`,
      digitalSealExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      verificationStatus: 'verified',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.notaryProfiles.set(testNotary.id, testNotary);

    // Configurar disponibilidad (Lunes a Viernes, 9:00 - 17:00)
    const weeklyAvailability: NotaryAvailability[] = [];
    for (let day = 1; day <= 5; day++) {
      weeklyAvailability.push({
        notaryId: testNotary.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
        isAvailable: true,
        maxAppointments: 8,
        breakStartTime: "12:00",
        breakEndTime: "13:00"
      });
    }
    this.availability.set(testNotary.id, weeklyAvailability);
  }

  private initializeServices() {
    const services: Omit<NotaryService, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        notaryId: 1,
        serviceType: "document_notarization",
        serviceName: "Notarización de Documentos",
        description: "Certificación notarial de documentos privados",
        basePrice: 15000,
        variableRate: 5000,
        variableFactor: "per_page",
        estimatedDuration: 30,
        requiresAppointment: true,
        availableRemotely: false,
        isActive: true
      },
      {
        notaryId: 1,
        serviceType: "identity_verification",
        serviceName: "Verificación de Identidad",
        description: "Verificación presencial de identidad para documentos",
        basePrice: 8000,
        estimatedDuration: 15,
        requiresAppointment: false,
        availableRemotely: true,
        isActive: true
      },
      {
        notaryId: 1,
        serviceType: "signature_witnessing",
        serviceName: "Testimonio de Firmas",
        description: "Testimonio notarial de firmas en documentos",
        basePrice: 12000,
        variableRate: 3000,
        variableFactor: "per_signature",
        estimatedDuration: 20,
        requiresAppointment: true,
        availableRemotely: true,
        isActive: true
      },
      {
        notaryId: 1,
        serviceType: "copy_certification",
        serviceName: "Certificación de Copias",
        description: "Certificación de copias fieles de documentos originales",
        basePrice: 5000,
        variableRate: 2000,
        variableFactor: "per_page",
        estimatedDuration: 10,
        requiresAppointment: false,
        availableRemotely: false,
        isActive: true
      },
      {
        notaryId: 1,
        serviceType: "oath_administration",
        serviceName: "Toma de Juramentos",
        description: "Administración de juramentos y declaraciones bajo juramento",
        basePrice: 10000,
        estimatedDuration: 25,
        requiresAppointment: true,
        availableRemotely: true,
        isActive: true
      }
    ];

    services.forEach(service => {
      const serviceId = `svc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      this.services.set(serviceId, {
        ...service,
        id: serviceId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
  }

  // Métodos públicos para notarios
  public getNotaryProfile(notaryId: number): NotaryProfile | undefined {
    return this.notaryProfiles.get(notaryId);
  }

  public getAllActiveNotaries(): NotaryProfile[] {
    return Array.from(this.notaryProfiles.values()).filter(n => n.isActive && n.verificationStatus === 'verified');
  }

  public getNotariesByJurisdiction(jurisdiction: string): NotaryProfile[] {
    return this.getAllActiveNotaries().filter(n => 
      n.jurisdiction.toLowerCase().includes(jurisdiction.toLowerCase())
    );
  }

  public getNotariesBySpecialization(specialization: string): NotaryProfile[] {
    return this.getAllActiveNotaries().filter(n =>
      n.specializations.some(s => s.toLowerCase().includes(specialization.toLowerCase()))
    );
  }

  // Métodos para servicios
  public getNotaryServices(notaryId: number): NotaryService[] {
    return Array.from(this.services.values()).filter(s => s.notaryId === notaryId && s.isActive);
  }

  public getServiceById(serviceId: string): NotaryService | undefined {
    return this.services.get(serviceId);
  }

  public calculateServiceFee(serviceId: string, variables?: { pages?: number; signatures?: number; hours?: number }): number {
    const service = this.getServiceById(serviceId);
    if (!service) return 0;

    let totalFee = service.basePrice;

    if (service.variableRate && service.variableFactor && variables) {
      switch (service.variableFactor) {
        case 'per_page':
          totalFee += (variables.pages || 1) * service.variableRate;
          break;
        case 'per_signature':
          totalFee += (variables.signatures || 1) * service.variableRate;
          break;
        case 'per_hour':
          totalFee += (variables.hours || 1) * service.variableRate;
          break;
      }
    }

    return totalFee;
  }

  // Métodos para citas
  public scheduleAppointment(appointment: Omit<NotaryAppointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>): string {
    const appointmentId = `apt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const newAppointment: NotaryAppointment = {
      ...appointment,
      id: appointmentId,
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.appointments.set(appointmentId, newAppointment);

    console.log(`📅 Cita programada: ${appointmentId} para ${appointment.appointmentDate.toLocaleString()}`);
    return appointmentId;
  }

  public getAppointment(appointmentId: string): NotaryAppointment | undefined {
    return this.appointments.get(appointmentId);
  }

  public getNotaryAppointments(notaryId: number, startDate?: Date, endDate?: Date): NotaryAppointment[] {
    let appointments = Array.from(this.appointments.values()).filter(a => a.notaryId === notaryId);

    if (startDate) {
      appointments = appointments.filter(a => a.appointmentDate >= startDate);
    }

    if (endDate) {
      appointments = appointments.filter(a => a.appointmentDate <= endDate);
    }

    return appointments.sort((a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime());
  }

  public getClientAppointments(clientId: number): NotaryAppointment[] {
    return Array.from(this.appointments.values())
      .filter(a => a.clientId === clientId)
      .sort((a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime());
  }

  public updateAppointmentStatus(appointmentId: string, status: NotaryAppointment['status']): boolean {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) return false;

    appointment.status = status;
    appointment.updatedAt = new Date();

    console.log(`📅 Cita ${appointmentId} actualizada a estado: ${status}`);
    return true;
  }

  // Métodos para notarización
  public notarizeDocument(
    documentId: string, 
    notaryId: number, 
    clientId: number,
    serviceType: string,
    options: {
      location: string;
      witnessCount: number;
      witnessNames?: string[];
      notes?: string;
      fee: number;
    }
  ): string {
    const document = documentManager.getDocument(documentId);
    const notary = this.getNotaryProfile(notaryId);
    
    if (!document || !notary) {
      throw new Error("Documento o notario no encontrado");
    }

    const recordId = `not_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const certificateNumber = `CERT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    
    // Crear registro de notarización
    const notarizationRecord: NotarizationRecord = {
      id: recordId,
      notaryId,
      documentId,
      clientId,
      serviceType,
      notarizationDate: new Date(),
      location: options.location,
      witnessCount: options.witnessCount,
      witnessNames: options.witnessNames,
      sealApplied: true,
      digitalSealHash: crypto.createHash('sha256').update(`${documentId}-${notaryId}-${Date.now()}`).digest('hex'),
      certificateNumber,
      notes: options.notes,
      fee: options.fee,
      paymentStatus: 'pending',
      createdAt: new Date()
    };

    this.notarizationRecords.set(recordId, notarizationRecord);

    // Actualizar documento con información notarial
    const notaryInfo: NotaryInfo = {
      notaryId,
      notaryName: notary.userId ? simpleStorage.findUserById(notary.userId)?.fullName || "Notario" : "Notario",
      licenseNumber: notary.licenseNumber,
      jurisdiction: notary.jurisdiction,
      sealApplied: true,
      notarizationDate: new Date(),
      witnessCount: options.witnessCount
    };

    document.notaryInfo = notaryInfo;
    document.timeline.push({
      id: `event_${Date.now()}`,
      type: 'notarized',
      description: `Documento notarizado por ${notaryInfo.notaryName}`,
      metadata: { 
        certificateNumber,
        notaryId,
        recordId 
      },
      timestamp: new Date()
    });

    // Cambiar estado del documento
    documentManager.updateDocumentStatus(documentId, 'completed', 'Documento notarizado exitosamente');

    console.log(`⚖️ Documento ${documentId} notarizado exitosamente. Certificado: ${certificateNumber}`);
    return recordId;
  }

  public getNotarizationRecord(recordId: string): NotarizationRecord | undefined {
    return this.notarizationRecords.get(recordId);
  }

  public verifyNotarization(certificateNumber: string): {
    isValid: boolean;
    record?: NotarizationRecord;
    notary?: NotaryProfile;
    document?: Document;
  } {
    // Buscar registro por número de certificado
    const record = Array.from(this.notarizationRecords.values())
      .find(r => r.certificateNumber === certificateNumber);

    if (!record) {
      return { isValid: false };
    }

    const notary = this.getNotaryProfile(record.notaryId);
    const document = documentManager.getDocument(record.documentId);

    return {
      isValid: true,
      record,
      notary,
      document
    };
  }

  // Métodos para disponibilidad
  public getNotaryAvailability(notaryId: number): NotaryAvailability[] {
    return this.availability.get(notaryId) || [];
  }

  public isNotaryAvailable(notaryId: number, date: Date): boolean {
    const availability = this.getNotaryAvailability(notaryId);
    const dayOfWeek = date.getDay();
    const timeString = date.toTimeString().slice(0, 5); // "HH:MM"

    const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);
    if (!dayAvailability || !dayAvailability.isAvailable) {
      return false;
    }

    // Verificar horario
    if (timeString < dayAvailability.startTime || timeString > dayAvailability.endTime) {
      return false;
    }

    // Verificar descanso
    if (dayAvailability.breakStartTime && dayAvailability.breakEndTime) {
      if (timeString >= dayAvailability.breakStartTime && timeString <= dayAvailability.breakEndTime) {
        return false;
      }
    }

    // Verificar citas existentes
    const existingAppointments = this.getNotaryAppointments(notaryId, date, date);
    return existingAppointments.length < dayAvailability.maxAppointments;
  }

  public getAvailableTimeSlots(notaryId: number, date: Date): string[] {
    const availability = this.getNotaryAvailability(notaryId);
    const dayOfWeek = date.getDay();
    
    const dayAvailability = availability.find(a => a.dayOfWeek === dayOfWeek);
    if (!dayAvailability || !dayAvailability.isAvailable) {
      return [];
    }

    const slots: string[] = [];
    const startHour = parseInt(dayAvailability.startTime.split(':')[0]);
    const endHour = parseInt(dayAvailability.endTime.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      
      // Saltar hora de descanso
      if (dayAvailability.breakStartTime && 
          timeSlot >= dayAvailability.breakStartTime && 
          timeSlot < dayAvailability.breakEndTime) {
        continue;
      }
      
      // Verificar si hay cita en este horario
      const slotDate = new Date(date);
      slotDate.setHours(hour, 0, 0, 0);
      
      if (this.isNotaryAvailable(notaryId, slotDate)) {
        slots.push(timeSlot);
      }
    }

    return slots;
  }

  // Métodos de estadísticas
  public getNotaryStats(notaryId: number): {
    totalNotarizations: number;
    thisMonthNotarizations: number;
    totalRevenue: number;
    thisMonthRevenue: number;
    averageRating: number;
    completionRate: number;
    upcomingAppointments: number;
  } {
    const records = Array.from(this.notarizationRecords.values())
      .filter(r => r.notaryId === notaryId);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const thisMonthRecords = records.filter(r => r.createdAt >= thisMonth);
    
    const appointments = this.getNotaryAppointments(notaryId);
    const completedAppointments = appointments.filter(a => a.status === 'completed');
    const upcomingAppointments = appointments.filter(a => 
      a.status === 'scheduled' || a.status === 'confirmed'
    ).length;

    return {
      totalNotarizations: records.length,
      thisMonthNotarizations: thisMonthRecords.length,
      totalRevenue: records.reduce((sum, r) => sum + r.fee, 0),
      thisMonthRevenue: thisMonthRecords.reduce((sum, r) => sum + r.fee, 0),
      averageRating: 4.8, // Simulado
      completionRate: appointments.length > 0 ? (completedAppointments.length / appointments.length) * 100 : 100,
      upcomingAppointments
    };
  }

  public getSystemStats(): {
    totalNotaries: number;
    activeNotaries: number;
    totalNotarizations: number;
    thisMonthNotarizations: number;
    totalRevenue: number;
    averageProcessingTime: number;
    topServices: { serviceName: string; count: number }[];
  } {
    const allNotaries = Array.from(this.notaryProfiles.values());
    const activeNotaries = allNotaries.filter(n => n.isActive && n.verificationStatus === 'verified');
    
    const allRecords = Array.from(this.notarizationRecords.values());
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const thisMonthRecords = allRecords.filter(r => r.createdAt >= thisMonth);
    
    // Contar servicios más populares
    const serviceCounts: Record<string, number> = {};
    allRecords.forEach(record => {
      const service = this.getServiceById(record.serviceType);
      const serviceName = service?.serviceName || record.serviceType;
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
    });

    const topServices = Object.entries(serviceCounts)
      .map(([serviceName, count]) => ({ serviceName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalNotaries: allNotaries.length,
      activeNotaries: activeNotaries.length,
      totalNotarizations: allRecords.length,
      thisMonthNotarizations: thisMonthRecords.length,
      totalRevenue: allRecords.reduce((sum, r) => sum + r.fee, 0),
      averageProcessingTime: 25, // minutos promedio (simulado)
      topServices
    };
  }

  // Métodos de búsqueda
  public searchNotaries(query: string, filters?: {
    jurisdiction?: string;
    specialization?: string;
    availableRemotely?: boolean;
  }): NotaryProfile[] {
    let notaries = this.getAllActiveNotaries();

    // Filtro por texto
    if (query) {
      notaries = notaries.filter(n => {
        const user = simpleStorage.findUserById(n.userId);
        const userName = user?.fullName || '';
        
        return userName.toLowerCase().includes(query.toLowerCase()) ||
               n.jurisdiction.toLowerCase().includes(query.toLowerCase()) ||
               n.specializations.some(s => s.toLowerCase().includes(query.toLowerCase()));
      });
    }

    // Aplicar filtros adicionales
    if (filters) {
      if (filters.jurisdiction) {
        notaries = notaries.filter(n => 
          n.jurisdiction.toLowerCase().includes(filters.jurisdiction!.toLowerCase())
        );
      }

      if (filters.specialization) {
        notaries = notaries.filter(n =>
          n.specializations.some(s => 
            s.toLowerCase().includes(filters.specialization!.toLowerCase())
          )
        );
      }

      if (filters.availableRemotely !== undefined) {
        const remoteServices = Array.from(this.services.values())
          .filter(s => s.availableRemotely === filters.availableRemotely);
        const notaryIds = new Set(remoteServices.map(s => s.notaryId));
        notaries = notaries.filter(n => notaryIds.has(n.id));
      }
    }

    return notaries;
  }

  /**
   * Generar certificado de notarización
   */
  public generateNotarizationCertificate(recordId: string): string {
    const record = this.getNotarizationRecord(recordId);
    if (!record) throw new Error("Registro de notarización no encontrado");

    const notary = this.getNotaryProfile(record.notaryId);
    const document = documentManager.getDocument(record.documentId);
    
    if (!notary || !document) throw new Error("Información incompleta para generar certificado");

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Certificado de Notarización</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; }
        .content { margin: 30px 0; }
        .seal { border: 3px solid #000; padding: 20px; margin: 30px 0; text-align: center; }
        .footer { margin-top: 50px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CERTIFICADO DE NOTARIZACIÓN</h1>
        <p><strong>Certificado N°:</strong> ${record.certificateNumber}</p>
        <p><strong>Fecha:</strong> ${record.notarizationDate.toLocaleDateString('es-CL')}</p>
    </div>
    
    <div class="content">
        <p>Yo, <strong>${notary.userId ? simpleStorage.findUserById(notary.userId)?.fullName : 'Notario'}</strong>, 
        Notario Público de ${notary.jurisdiction}, Licencia N° ${notary.licenseNumber}, 
        CERTIFICO que:</p>
        
        <ol>
            <li>El documento identificado como "${document.title}" (ID: ${document.id}) 
            ha sido debidamente notarizado en mi presencia.</li>
            
            <li>La identidad de los firmantes ha sido verificada mediante documentos oficiales.</li>
            
            <li>Las firmas fueron aplicadas voluntariamente y en pleno conocimiento 
            del contenido del documento.</li>
            
            <li>Se contó con la presencia de ${record.witnessCount} testigo(s) 
            ${record.witnessNames ? `(${record.witnessNames.join(', ')})` : ''}.</li>
            
            <li>El sello digital ha sido aplicado con hash de verificación: 
            ${record.digitalSealHash.substring(0, 16)}...</li>
        </ol>
        
        ${record.notes ? `<p><strong>Observaciones:</strong> ${record.notes}</p>` : ''}
    </div>
    
    <div class="seal">
        <h3>SELLO NOTARIAL DIGITAL</h3>
        <p><strong>${notary.registryNumber}</strong></p>
        <p>Válido hasta: ${notary.digitalSealExpiry.toLocaleDateString('es-CL')}</p>
        <p>Hash: ${record.digitalSealHash}</p>
    </div>
    
    <div class="footer">
        <p>Este certificado fue generado digitalmente por DocuSignPro</p>
        <p>Verificación disponible en: https://docusignpro.com/verify/${record.certificateNumber}</p>
    </div>
</body>
</html>`;
  }

  /**
   * Validar certificado de notarización
   */
  public validateCertificate(certificateNumber: string): {
    isValid: boolean;
    record?: NotarizationRecord;
    errors: string[];
  } {
    const errors: string[] = [];
    const record = Array.from(this.notarizationRecords.values())
      .find(r => r.certificateNumber === certificateNumber);

    if (!record) {
      errors.push("Certificado no encontrado");
      return { isValid: false, errors };
    }

    const notary = this.getNotaryProfile(record.notaryId);
    if (!notary) {
      errors.push("Notario no encontrado");
    } else if (!notary.isActive) {
      errors.push("Notario no activo");
    } else if (notary.verificationStatus !== 'verified') {
      errors.push("Notario no verificado");
    } else if (new Date() > notary.digitalSealExpiry) {
      errors.push("Sello digital expirado");
    }

    return {
      isValid: errors.length === 0,
      record,
      errors
    };
  }
}

// Instancia singleton
export const notaryManager = new NotaryManager();