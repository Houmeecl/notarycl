import crypto from "crypto";
import { simpleStorage } from "../simple-storage";

export interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'password_change' | 'suspicious_activity' | 'document_access' | 'admin_action';
  userId?: number;
  ipAddress: string;
  userAgent: string;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface RateLimitRule {
  endpoint: string;
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface IPBlocklist {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface SessionInfo {
  sessionId: string;
  userId: number;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface SecurityAlert {
  id: string;
  type: 'multiple_failed_logins' | 'suspicious_ip' | 'unusual_activity' | 'potential_breach';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: number;
  ipAddress?: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: number;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export class SecurityManager {
  private securityEvents: Map<string, SecurityEvent> = new Map();
  private rateLimitData: Map<string, { requests: number; resetTime: number; blocked: boolean }> = new Map();
  private ipBlocklist: Map<string, IPBlocklist> = new Map();
  private activeSessions: Map<string, SessionInfo> = new Map();
  private securityAlerts: Map<string, SecurityAlert> = new Map();
  private rateLimitRules: RateLimitRule[] = [];

  constructor() {
    this.initializeRateLimitRules();
    this.startSecurityMonitoring();
    console.log("🛡️ Gestor de Seguridad inicializado");
  }

  private initializeRateLimitRules() {
    this.rateLimitRules = [
      {
        endpoint: '/api/auth/login',
        maxRequests: 5,
        windowMs: 15 * 60 * 1000, // 15 minutos
        blockDurationMs: 30 * 60 * 1000 // 30 minutos
      },
      {
        endpoint: '/api/auth/register',
        maxRequests: 3,
        windowMs: 60 * 60 * 1000, // 1 hora
        blockDurationMs: 60 * 60 * 1000 // 1 hora
      },
      {
        endpoint: '/api/documents',
        maxRequests: 100,
        windowMs: 60 * 60 * 1000, // 1 hora
        blockDurationMs: 10 * 60 * 1000 // 10 minutos
      },
      {
        endpoint: '/api/payments/create',
        maxRequests: 10,
        windowMs: 60 * 60 * 1000, // 1 hora
        blockDurationMs: 60 * 60 * 1000 // 1 hora
      }
    ];
  }

  private startSecurityMonitoring() {
    // Limpiar eventos antiguos cada hora
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000);

    // Verificar patrones sospechosos cada 5 minutos
    setInterval(() => {
      this.detectSuspiciousPatterns();
    }, 5 * 60 * 1000);

    // Limpiar sesiones inactivas cada 30 minutos
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 30 * 60 * 1000);
  }

  // Métodos de eventos de seguridad
  public logSecurityEvent(
    type: SecurityEvent['type'],
    ipAddress: string,
    userAgent: string,
    details: string,
    severity: SecurityEvent['severity'] = 'low',
    userId?: number,
    metadata?: Record<string, any>
  ): void {
    const eventId = `sec_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const event: SecurityEvent = {
      id: eventId,
      type,
      userId,
      ipAddress,
      userAgent,
      details,
      severity,
      metadata,
      timestamp: new Date()
    };

    this.securityEvents.set(eventId, event);

    // Log crítico en consola
    if (severity === 'critical' || severity === 'high') {
      console.warn(`🚨 SECURITY ALERT [${severity.toUpperCase()}]: ${details} - IP: ${ipAddress}`);
    }

    // Crear alerta si es necesario
    if (severity === 'critical') {
      this.createSecurityAlert('potential_breach', 'Actividad Crítica Detectada', details, severity, userId, ipAddress);
    }
  }

  public getSecurityEvents(filters?: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    userId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let events = Array.from(this.securityEvents.values());

    if (filters) {
      if (filters.type) {
        events = events.filter(e => e.type === filters.type);
      }
      
      if (filters.severity) {
        events = events.filter(e => e.severity === filters.severity);
      }
      
      if (filters.userId) {
        events = events.filter(e => e.userId === filters.userId);
      }
      
      if (filters.startDate) {
        events = events.filter(e => e.timestamp >= filters.startDate!);
      }
      
      if (filters.endDate) {
        events = events.filter(e => e.timestamp <= filters.endDate!);
      }
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  // Métodos de rate limiting
  public checkRateLimit(endpoint: string, ipAddress: string): {
    allowed: boolean;
    remainingRequests?: number;
    resetTime?: number;
    retryAfter?: number;
  } {
    const rule = this.rateLimitRules.find(r => endpoint.startsWith(r.endpoint));
    if (!rule) {
      return { allowed: true };
    }

    const key = `${endpoint}:${ipAddress}`;
    const now = Date.now();
    const existing = this.rateLimitData.get(key);

    if (!existing) {
      this.rateLimitData.set(key, {
        requests: 1,
        resetTime: now + rule.windowMs,
        blocked: false
      });
      return { 
        allowed: true, 
        remainingRequests: rule.maxRequests - 1,
        resetTime: now + rule.windowMs
      };
    }

    // Verificar si está bloqueado
    if (existing.blocked) {
      const blockExpiry = existing.resetTime + rule.blockDurationMs;
      if (now < blockExpiry) {
        return {
          allowed: false,
          retryAfter: Math.ceil((blockExpiry - now) / 1000)
        };
      } else {
        // Desbloquear
        existing.blocked = false;
        existing.requests = 1;
        existing.resetTime = now + rule.windowMs;
        return { allowed: true, remainingRequests: rule.maxRequests - 1 };
      }
    }

    // Verificar ventana de tiempo
    if (now > existing.resetTime) {
      existing.requests = 1;
      existing.resetTime = now + rule.windowMs;
      return { 
        allowed: true, 
        remainingRequests: rule.maxRequests - 1,
        resetTime: existing.resetTime
      };
    }

    // Incrementar contador
    existing.requests++;

    if (existing.requests > rule.maxRequests) {
      existing.blocked = true;
      
      this.logSecurityEvent(
        'suspicious_activity',
        ipAddress,
        'Rate Limit Exceeded',
        `Rate limit exceeded for ${endpoint}`,
        'medium',
        undefined,
        { endpoint, requests: existing.requests, rule }
      );

      return {
        allowed: false,
        retryAfter: Math.ceil(rule.blockDurationMs / 1000)
      };
    }

    return {
      allowed: true,
      remainingRequests: rule.maxRequests - existing.requests,
      resetTime: existing.resetTime
    };
  }

  // Métodos de bloqueo de IP
  public blockIP(ip: string, reason: string, durationMs?: number): void {
    const blockEntry: IPBlocklist = {
      ip,
      reason,
      blockedAt: new Date(),
      expiresAt: durationMs ? new Date(Date.now() + durationMs) : undefined,
      isActive: true
    };

    this.ipBlocklist.set(ip, blockEntry);
    
    this.logSecurityEvent(
      'suspicious_activity',
      ip,
      'System',
      `IP bloqueada: ${reason}`,
      'high',
      undefined,
      { reason, durationMs }
    );

    console.log(`🚫 IP ${ip} bloqueada: ${reason}`);
  }

  public isIPBlocked(ip: string): boolean {
    const blockEntry = this.ipBlocklist.get(ip);
    
    if (!blockEntry || !blockEntry.isActive) {
      return false;
    }

    if (blockEntry.expiresAt && new Date() > blockEntry.expiresAt) {
      blockEntry.isActive = false;
      return false;
    }

    return true;
  }

  public unblockIP(ip: string): boolean {
    const blockEntry = this.ipBlocklist.get(ip);
    
    if (blockEntry) {
      blockEntry.isActive = false;
      console.log(`✅ IP ${ip} desbloqueada`);
      return true;
    }

    return false;
  }

  // Métodos de gestión de sesiones
  public createSession(userId: number, ipAddress: string, userAgent: string): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    const session: SessionInfo = {
      sessionId,
      userId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.activeSessions.set(sessionId, session);

    this.logSecurityEvent(
      'login_success',
      ipAddress,
      userAgent,
      `Sesión creada para usuario ${userId}`,
      'low',
      userId,
      { sessionId }
    );

    return sessionId;
  }

  public validateSession(sessionId: string, ipAddress: string): SessionInfo | null {
    const session = this.activeSessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return null;
    }

    // Verificar IP (opcional, puede ser más flexible)
    if (session.ipAddress !== ipAddress) {
      this.logSecurityEvent(
        'suspicious_activity',
        ipAddress,
        'Session Validation',
        `Sesión accedida desde IP diferente. Original: ${session.ipAddress}, Actual: ${ipAddress}`,
        'medium',
        session.userId,
        { sessionId, originalIP: session.ipAddress }
      );
    }

    // Actualizar última actividad
    session.lastActivity = new Date();
    
    return session;
  }

  public invalidateSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    
    if (session) {
      session.isActive = false;
      return true;
    }

    return false;
  }

  // Métodos de detección de patrones sospechosos
  private detectSuspiciousPatterns(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Detectar múltiples intentos de login fallidos
    this.detectMultipleFailedLogins(oneHourAgo);
    
    // Detectar acceso desde múltiples IPs
    this.detectMultipleIPAccess(oneHourAgo);
    
    // Detectar actividad inusual
    this.detectUnusualActivity(oneHourAgo);
  }

  private detectMultipleFailedLogins(since: Date): void {
    const failedLogins = this.getSecurityEvents({
      type: 'login_failure',
      startDate: since
    });

    // Agrupar por IP
    const failuresByIP: Record<string, SecurityEvent[]> = {};
    failedLogins.forEach(event => {
      if (!failuresByIP[event.ipAddress]) {
        failuresByIP[event.ipAddress] = [];
      }
      failuresByIP[event.ipAddress].push(event);
    });

    // Verificar IPs con muchos fallos
    Object.entries(failuresByIP).forEach(([ip, events]) => {
      if (events.length >= 10) {
        this.createSecurityAlert(
          'multiple_failed_logins',
          'Múltiples Intentos de Login Fallidos',
          `${events.length} intentos fallidos desde IP ${ip} en la última hora`,
          'high',
          undefined,
          ip
        );

        // Bloquear IP automáticamente
        if (events.length >= 20) {
          this.blockIP(ip, 'Múltiples intentos de login fallidos', 24 * 60 * 60 * 1000); // 24 horas
        }
      }
    });
  }

  private detectMultipleIPAccess(since: Date): void {
    const loginEvents = this.getSecurityEvents({
      type: 'login_success',
      startDate: since
    });

    // Agrupar por usuario
    const loginsByUser: Record<number, Set<string>> = {};
    loginEvents.forEach(event => {
      if (event.userId) {
        if (!loginsByUser[event.userId]) {
          loginsByUser[event.userId] = new Set();
        }
        loginsByUser[event.userId].add(event.ipAddress);
      }
    });

    // Verificar usuarios con múltiples IPs
    Object.entries(loginsByUser).forEach(([userId, ips]) => {
      if (ips.size >= 5) {
        this.createSecurityAlert(
          'suspicious_ip',
          'Acceso desde Múltiples IPs',
          `Usuario ${userId} ha accedido desde ${ips.size} IPs diferentes en la última hora`,
          'medium',
          parseInt(userId)
        );
      }
    });
  }

  private detectUnusualActivity(since: Date): void {
    // Detectar actividad fuera de horarios normales
    const events = this.getSecurityEvents({ startDate: since });
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      
      // Actividad entre 2 AM y 6 AM es sospechosa
      if (hour >= 2 && hour <= 6) {
        this.createSecurityAlert(
          'unusual_activity',
          'Actividad Fuera de Horario',
          `Actividad detectada a las ${event.timestamp.toLocaleTimeString()} desde IP ${event.ipAddress}`,
          'low',
          event.userId,
          event.ipAddress
        );
      }
    });
  }

  // Métodos de alertas de seguridad
  private createSecurityAlert(
    type: SecurityAlert['type'],
    title: string,
    description: string,
    severity: SecurityAlert['severity'],
    userId?: number,
    ipAddress?: string,
    metadata?: Record<string, any>
  ): void {
    const alertId = `alert_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const alert: SecurityAlert = {
      id: alertId,
      type,
      title,
      description,
      severity,
      userId,
      ipAddress,
      metadata,
      acknowledged: false,
      createdAt: new Date()
    };

    this.securityAlerts.set(alertId, alert);

    console.log(`🚨 SECURITY ALERT [${severity.toUpperCase()}]: ${title} - ${description}`);
  }

  public getSecurityAlerts(filters?: {
    severity?: SecurityAlert['severity'];
    acknowledged?: boolean;
    limit?: number;
  }): SecurityAlert[] {
    let alerts = Array.from(this.securityAlerts.values());

    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      
      if (filters.acknowledged !== undefined) {
        alerts = alerts.filter(a => a.acknowledged === filters.acknowledged);
      }
    }

    alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: number): boolean {
    const alert = this.securityAlerts.get(alertId);
    
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    console.log(`✅ Alerta ${alertId} reconocida por usuario ${acknowledgedBy}`);
    return true;
  }

  // Métodos de validación de entrada
  public validateInput(input: string, type: 'email' | 'username' | 'password' | 'text'): {
    isValid: boolean;
    errors: string[];
    sanitized: string;
  } {
    const errors: string[] = [];
    let sanitized = input.trim();

    // Detectar posibles ataques
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
      /('|(\\')|(;|%3B)|(--)|(\|)|(\*)|(\%)|(\+))/gi, // SQL Injection
      /(union|select|insert|delete|update|drop|create|alter|exec|execute)/gi, // SQL keywords
      /(<|>|&lt;|&gt;|&amp;)/gi // HTML entities
    ];

    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(input)) {
        errors.push('Contenido potencialmente malicioso detectado');
      }
    });

    // Validaciones específicas por tipo
    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitized)) {
          errors.push('Formato de email inválido');
        }
        break;
        
      case 'username':
        if (sanitized.length < 3 || sanitized.length > 50) {
          errors.push('Usuario debe tener entre 3 y 50 caracteres');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
          errors.push('Usuario solo puede contener letras, números, guiones y guiones bajos');
        }
        break;
        
      case 'password':
        if (sanitized.length < 8) {
          errors.push('Contraseña debe tener al menos 8 caracteres');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(sanitized)) {
          errors.push('Contraseña debe contener al menos una mayúscula, una minúscula y un número');
        }
        break;
        
      case 'text':
        if (sanitized.length > 5000) {
          errors.push('Texto demasiado largo (máximo 5000 caracteres)');
        }
        break;
    }

    // Sanitizar contenido
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }

  // Métodos de auditoría
  public getSecurityReport(startDate: Date, endDate: Date): {
    period: { start: Date; end: Date };
    summary: {
      totalEvents: number;
      criticalEvents: number;
      highSeverityEvents: number;
      blockedIPs: number;
      activeAlerts: number;
      acknowledgedAlerts: number;
    };
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topIPs: { ip: string; events: number }[];
    timeline: { date: string; events: number }[];
  } {
    const events = this.getSecurityEvents({ startDate, endDate });
    
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};

    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
    });

    const topIPs = Object.entries(ipCounts)
      .map(([ip, events]) => ({ ip, events }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10);

    // Timeline por día
    const timeline: Record<string, number> = {};
    events.forEach(event => {
      const dateStr = event.timestamp.toISOString().split('T')[0];
      timeline[dateStr] = (timeline[dateStr] || 0) + 1;
    });

    const timelineArray = Object.entries(timeline)
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const alerts = this.getSecurityAlerts();
    const activeAlerts = alerts.filter(a => !a.acknowledged);

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalEvents: events.length,
        criticalEvents: events.filter(e => e.severity === 'critical').length,
        highSeverityEvents: events.filter(e => e.severity === 'high').length,
        blockedIPs: Array.from(this.ipBlocklist.values()).filter(b => b.isActive).length,
        activeAlerts: activeAlerts.length,
        acknowledgedAlerts: alerts.filter(a => a.acknowledged).length
      },
      eventsByType,
      eventsBySeverity,
      topIPs,
      timeline: timelineArray
    };
  }

  // Métodos de limpieza
  private cleanupOldEvents(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    this.securityEvents.forEach((event, id) => {
      if (event.timestamp < thirtyDaysAgo) {
        this.securityEvents.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} eventos de seguridad antiguos limpiados`);
    }
  }

  private cleanupInactiveSessions(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleaned = 0;

    this.activeSessions.forEach((session, id) => {
      if (session.lastActivity < oneHourAgo) {
        session.isActive = false;
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} sesiones inactivas limpiadas`);
    }
  }

  // Métodos de encriptación
  public encryptSensitiveData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync('docusignpro-secret-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  public decryptSensitiveData(encryptedData: string): string {
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync('docusignpro-secret-key', 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Error desencriptando datos');
    }
  }

  // Métodos de hash para verificación de integridad
  public generateDocumentHash(documentContent: string): string {
    return crypto.createHash('sha256').update(documentContent).digest('hex');
  }

  public verifyDocumentIntegrity(documentContent: string, expectedHash: string): boolean {
    const actualHash = this.generateDocumentHash(documentContent);
    return actualHash === expectedHash;
  }

  // Estadísticas de seguridad
  public getSecurityStats(): {
    totalEvents: number;
    criticalAlerts: number;
    blockedIPs: number;
    activeSessions: number;
    recentEvents: SecurityEvent[];
    alertsByType: Record<string, number>;
  } {
    const events = Array.from(this.securityEvents.values());
    const alerts = Array.from(this.securityAlerts.values());
    const activeSessions = Array.from(this.activeSessions.values()).filter(s => s.isActive);
    const blockedIPs = Array.from(this.ipBlocklist.values()).filter(b => b.isActive);

    const alertsByType: Record<string, number> = {};
    alerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length,
      blockedIPs: blockedIPs.length,
      activeSessions: activeSessions.length,
      recentEvents: events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10),
      alertsByType
    };
  }
}

// Instancia singleton
export const securityManager = new SecurityManager();