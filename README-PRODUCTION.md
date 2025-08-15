# DocuSignPro - Guía de Producción

## 🚨 IMPORTANTE: Usuarios de Prueba Hardcodeados

Este sistema contiene **usuarios de prueba hardcodeados** en el código que **DEBEN SER ELIMINADOS** antes del despliegue en producción.

### Ubicación: `server/routes.ts` (función `initializeTestAdmins`)

```typescript
// ⚠️ ELIMINAR EN PRODUCCIÓN
async function initializeTestAdmins() {
  // Usuarios hardcodeados con contraseñas débiles
  const adminUsers = [
    'Edwardadmin/adminq',
    'Sebadmin/admin123', 
    'nfcadmin/nfc123',
    'vecinosadmin/vecinos123',
    'miadmin/miadmin123'
  ];
  
  const partnerUsers = [
    'demopartner/password123',
    'partner1/partner123',
    'partner2/partner456',
    'partner3/partner789',
    'partner4/partner789'
  ];
}
```

## 🛠️ Configuración para VPS

### 1. Base de Datos Externa

#### Crear PostgreSQL
```sql
CREATE DATABASE docusignpro;
CREATE USER docusign_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE docusignpro TO docusign_user;
```

#### Variables de Entorno
```bash
DATABASE_URL="postgresql://docusign_user:password@host:5432/docusignpro"
SESSION_SECRET="clave_super_secreta_y_larga_para_produccion"
NODE_ENV="production"
```

### 2. Migración de Storage

#### Cambiar en `server/storage.ts`:
```typescript
// ANTES (desarrollo):
export const storage = new MemStorage();

// DESPUÉS (producción):
export const storage = new DatabaseStorage();
```

#### Ejecutar migraciones:
```bash
npm run db:push
```

### 3. Eliminar Usuarios de Prueba

#### En `server/routes.ts`:
```typescript
// COMENTAR O ELIMINAR esta línea:
// await initializeTestAdmins(); 
```

## 📋 Scripts de Migración Disponibles

### Verificar Conexión DB
```bash
tsx scripts/check-db-connection.ts
```

### Backup de Datos Actuales
```bash
tsx scripts/backup-mem-storage.ts
```

### Migrar a Base de Datos
```bash
tsx scripts/migrate-to-database.ts
```

### Configuración Automática
```bash
./scripts/setup-external-db.sh
```

## 🔒 Seguridad en Producción

### 1. Contraseñas
- [ ] Cambiar todas las contraseñas por defecto
- [ ] Usar generador de contraseñas seguras
- [ ] Implementar política de contraseñas

### 2. Servidor
- [ ] Configurar SSL/TLS (HTTPS)
- [ ] Configurar firewall
- [ ] Deshabilitar puertos innecesarios
- [ ] Configurar fail2ban

### 3. Base de Datos
- [ ] Restringir acceso por IP
- [ ] Configurar backup automático
- [ ] Habilitar logs de auditoría

## 🚀 Despliegue

### 1. Proceso de Construcción
```bash
npm run build
```

### 2. Proceso de Inicio
```bash
NODE_ENV=production npm start
```

### 3. Verificación Post-Despliegue
- [ ] Servidor responde en puerto 5000
- [ ] Base de datos conecta correctamente
- [ ] Autenticación funciona
- [ ] Usuarios de prueba eliminados
- [ ] SSL/HTTPS configurado

## 📊 Monitoreo

### Logs Importantes
```bash
# Logs de aplicación
tail -f logs/app.log

# Logs de base de datos
tail -f /var/log/postgresql/postgresql.log

# Logs del sistema
tail -f /var/log/syslog
```

### Métricas a Monitorear
- Uso de CPU y memoria
- Conexiones activas a base de datos
- Tiempo de respuesta de endpoints
- Errores de autenticación
- Espacio en disco

## 🔄 Backup y Recuperación

### Backup Base de Datos
```bash
pg_dump -h host -U docusign_user docusignpro > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Backup Aplicación
```bash
tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz /path/to/app
```

### Restauración
```bash
psql -h host -U docusign_user docusignpro < backup_file.sql
```

## 📞 Contacto y Soporte

- **Desarrollador**: Configurar contacto del equipo de desarrollo
- **Documentación**: Enlaces a documentación técnica
- **Logs**: Ubicación de archivos de logs
- **Backup**: Programación de respaldos automáticos

---

**⚠️ RECORDATORIO FINAL**: Este archivo README-PRODUCTION.md contiene información crítica para el despliegue seguro. Asegúrate de seguir todos los pasos antes de poner el sistema en producción.