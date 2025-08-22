# 🚀 DocuSignPro Complete - Guía de Despliegue a VPS

## 📋 **Guía Paso a Paso para Producción**

Esta guía te llevará desde cero hasta tener **DocuSignPro Complete** funcionando en tu VPS con **HTTPS**, **base de datos PostgreSQL**, y **monitoreo automático**.

---

## 🎯 **Requisitos del VPS**

### **Especificaciones Mínimas**
- **OS**: Ubuntu 20.04+ o Debian 11+
- **RAM**: 2 GB mínimo (4 GB recomendado)
- **CPU**: 2 cores mínimo
- **Almacenamiento**: 20 GB mínimo (50 GB recomendado)
- **Ancho de banda**: Ilimitado o 1TB+

### **Proveedores Recomendados**
- **DigitalOcean**: Droplet $20/mes (4GB RAM, 2 CPU)
- **Linode**: VPS $20/mes (4GB RAM, 2 CPU)
- **Vultr**: VPS $20/mes (4GB RAM, 2 CPU)
- **AWS**: EC2 t3.medium ($30/mes aprox)
- **Google Cloud**: e2-medium ($25/mes aprox)

---

## 🔧 **Preparación Inicial**

### **1. Acceso al VPS**
```bash
# Conectar por SSH
ssh root@TU_IP_VPS

# O si tienes usuario no-root
ssh usuario@TU_IP_VPS
sudo su -
```

### **2. Configurar Dominio (Opcional pero Recomendado)**
```bash
# En tu proveedor de DNS (Cloudflare, Namecheap, etc.)
# Crear registros A:
# tudominio.com     → IP_DE_TU_VPS
# www.tudominio.com → IP_DE_TU_VPS
# api.tudominio.com → IP_DE_TU_VPS
```

---

## 🚀 **Despliegue Automático**

### **Opción 1: Despliegue Completo Automático**

```bash
# 1. Descargar scripts de despliegue
wget https://raw.githubusercontent.com/tu-repo/docusignpro/main/deployment/deploy.sh
wget https://raw.githubusercontent.com/tu-repo/docusignpro/main/deployment/deploy-app.sh

# 2. Hacer ejecutables
chmod +x deploy.sh deploy-app.sh

# 3. Ejecutar instalación base
./deploy.sh tudominio.com

# 4. Ejecutar despliegue de aplicación
./deploy-app.sh tudominio.com
```

### **Opción 2: Despliegue Manual Paso a Paso**

#### **Paso 1: Instalación de Dependencias**
```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Instalar PostgreSQL
apt-get install -y postgresql postgresql-contrib

# Instalar Nginx
apt-get install -y nginx

# Instalar Certbot para SSL
apt-get install -y certbot python3-certbot-nginx

# Instalar herramientas adicionales
apt-get install -y git curl wget unzip htop
```

#### **Paso 2: Configurar PostgreSQL**
```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE docusignpro;
CREATE USER docusign_user WITH PASSWORD 'TU_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE docusignpro TO docusign_user;
ALTER DATABASE docusignpro OWNER TO docusign_user;
\q
```

#### **Paso 3: Configurar Aplicación**
```bash
# Crear directorio del proyecto
mkdir -p /var/www/docusignpro
cd /var/www/docusignpro

# Clonar o subir código
# Opción A: Desde repositorio Git
git clone https://github.com/tu-usuario/docusignpro.git .

# Opción B: Subir archivos con SCP/SFTP
# scp -r ./docusignpro/* root@TU_IP:/var/www/docusignpro/

# Configurar permisos
chown -R www-data:www-data /var/www/docusignpro
```

#### **Paso 4: Configurar Variables de Entorno**
```bash
# Crear archivo .env de producción
cat > /var/www/docusignpro/.env << 'EOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Base de datos (cambiar password)
DATABASE_URL=postgresql://docusign_user:TU_PASSWORD_SEGURO@localhost:5432/docusignpro

# Seguridad (generar claves seguras)
SESSION_SECRET=GENERAR_CLAVE_SUPER_SECRETA_64_CHARS_MINIMO
JWT_SECRET=GENERAR_JWT_SECRET_SUPER_SEGURO

# Dominio
DOMAIN=tudominio.com
API_URL=https://api.tudominio.com
FRONTEND_URL=https://tudominio.com

# ⚠️ CONFIGURAR CON CREDENCIALES REALES:

# Agora.io (Videollamadas RON)
AGORA_APP_ID=tu_agora_app_id
AGORA_APP_CERTIFICATE=tu_agora_certificate

# Stripe
STRIPE_SECRET_KEY=sk_live_tu_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_tu_stripe_public

# PayPal
PAYPAL_CLIENT_ID=tu_paypal_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_secret
PAYPAL_MODE=live

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=tu_mercadopago_token

# SendGrid (Email)
SENDGRID_API_KEY=SG.tu_sendgrid_key
FROM_EMAIL=noreply@tudominio.com

# OpenAI
OPENAI_API_KEY=sk-tu_openai_key
EOF

# Configurar permisos seguros
chown www-data:www-data /var/www/docusignpro/.env
chmod 600 /var/www/docusignpro/.env
```

#### **Paso 5: Instalar y Construir**
```bash
cd /var/www/docusignpro

# Instalar dependencias
sudo -u www-data npm ci --only=production

# Construir aplicación
sudo -u www-data npm run build

# Ejecutar migraciones de base de datos
sudo -u www-data npm run db:push
```

#### **Paso 6: Configurar Nginx**
```bash
# Crear configuración de Nginx
cat > /etc/nginx/sites-available/docusignpro << 'EOF'
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;
    
    # SSL configurado por Certbot
    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Headers de seguridad
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Proxy a la aplicación
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Archivos estáticos
    location /assets {
        alias /var/www/docusignpro/dist/public/assets;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    client_max_body_size 50M;
}
EOF

# Habilitar sitio
ln -s /etc/nginx/sites-available/docusignpro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
nginx -t
```

#### **Paso 7: Configurar SSL**
```bash
# Obtener certificados SSL gratuitos
certbot --nginx -d tudominio.com -d www.tudominio.com

# Configurar renovación automática
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

#### **Paso 8: Configurar Servicio Systemd**
```bash
# Crear servicio systemd
cat > /etc/systemd/system/docusignpro.service << 'EOF'
[Unit]
Description=DocuSignPro Complete - Enterprise Document Management
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/docusignpro
Environment=NODE_ENV=production
EnvironmentFile=/var/www/docusignpro/.env
ExecStart=/usr/bin/node /var/www/docusignpro/dist/production-server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=docusignpro

# Límites de recursos
LimitNOFILE=65536
LimitNPROC=4096

# Seguridad
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/docusignpro /tmp /var/log/docusignpro

[Install]
WantedBy=multi-user.target
EOF

# Habilitar y iniciar servicio
systemctl daemon-reload
systemctl enable docusignpro
systemctl start docusignpro
```

#### **Paso 9: Configurar Firewall**
```bash
# Configurar UFW
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

#### **Paso 10: Verificar Despliegue**
```bash
# Verificar estado del servicio
systemctl status docusignpro

# Verificar logs
journalctl -u docusignpro -f

# Verificar que responde
curl https://tudominio.com/api/health

# Verificar Nginx
nginx -t
systemctl status nginx
```

---

## 🔧 **Configuración Post-Despliegue**

### **1. Configurar Credenciales Reales**

Edita `/var/www/docusignpro/.env` con tus credenciales reales:

```bash
# Agora.io (para videollamadas RON)
# Registrarse en: https://console.agora.io/
AGORA_APP_ID=tu_app_id_real
AGORA_APP_CERTIFICATE=tu_certificate_real

# Stripe (para pagos)
# Dashboard: https://dashboard.stripe.com/
STRIPE_SECRET_KEY=sk_live_tu_key_real
STRIPE_PUBLISHABLE_KEY=pk_live_tu_key_real

# SendGrid (para emails)
# Panel: https://sendgrid.com/
SENDGRID_API_KEY=SG.tu_key_real
FROM_EMAIL=noreply@tudominio.com

# OpenAI (para IA)
# Platform: https://platform.openai.com/
OPENAI_API_KEY=sk-tu_key_real
```

### **2. Reiniciar Después de Cambios**
```bash
# Reiniciar aplicación
systemctl restart docusignpro

# Verificar que funciona
curl https://tudominio.com/api/health
```

### **3. Crear Usuario Administrador**
```bash
# El sistema crea automáticamente un admin
# Ver credenciales en los logs:
journalctl -u docusignpro | grep "ADMINISTRADOR CREADO"

# O crear manualmente:
# Acceder a https://tudominio.com/enhanced
# Usar la función de registro con rol admin
```

---

## 📊 **Monitoreo y Mantenimiento**

### **Comandos Útiles**
```bash
# Estado del servicio
systemctl status docusignpro

# Ver logs en tiempo real
journalctl -u docusignpro -f

# Reiniciar aplicación
systemctl restart docusignpro

# Verificar salud del sistema
curl https://tudominio.com/api/health

# Ver métricas (requiere autenticación admin)
curl -H "Authorization: Bearer TOKEN" https://tudominio.com/api/metrics

# Backup manual
/usr/local/bin/docusignpro_backup.sh

# Verificar certificados SSL
certbot certificates

# Renovar certificados SSL
certbot renew
```

### **Logs Importantes**
```bash
# Logs de aplicación
journalctl -u docusignpro

# Logs de Nginx
tail -f /var/log/nginx/docusignpro.access.log
tail -f /var/log/nginx/docusignpro.error.log

# Logs del sistema
tail -f /var/log/syslog

# Logs de PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log
```

---

## 🛡️ **Seguridad en Producción**

### **Checklist de Seguridad**
- [ ] ✅ Firewall configurado (solo puertos 22, 80, 443)
- [ ] ✅ SSL/HTTPS habilitado con Let's Encrypt
- [ ] ✅ Rate limiting activo
- [ ] ✅ Headers de seguridad configurados
- [ ] ✅ Contraseñas seguras generadas
- [ ] ✅ Usuarios de prueba eliminados
- [ ] ✅ Logs de seguridad activos
- [ ] ✅ Backup automático configurado

### **Configuraciones Adicionales de Seguridad**
```bash
# Instalar Fail2Ban para protección SSH
apt-get install -y fail2ban

# Configurar Fail2Ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
EOF

systemctl restart fail2ban
```

---

## 📦 **Backup y Recuperación**

### **Backup Automático Configurado**
- **Frecuencia**: Diario a las 2:00 AM
- **Retención**: 30 días
- **Ubicación**: `/backups/docusignpro/`
- **Incluye**: Base de datos + archivos de aplicación

### **Backup Manual**
```bash
# Ejecutar backup inmediato
/usr/local/bin/docusignpro_backup.sh

# Ver backups disponibles
ls -la /backups/docusignpro/

# Restaurar desde backup
# 1. Restaurar base de datos
psql -h localhost -U docusign_user docusignpro < /backups/docusignpro/db_backup_FECHA.sql

# 2. Restaurar archivos
tar -xzf /backups/docusignpro/app_backup_FECHA.tar.gz -C /var/www/docusignpro/
```

---

## 🔄 **Actualizaciones y Mantenimiento**

### **Actualizar Aplicación**
```bash
cd /var/www/docusignpro

# 1. Hacer backup antes de actualizar
/usr/local/bin/docusignpro_backup.sh

# 2. Actualizar código
sudo -u www-data git pull origin main

# 3. Instalar nuevas dependencias
sudo -u www-data npm ci --only=production

# 4. Construir nueva versión
sudo -u www-data npm run build

# 5. Ejecutar migraciones si las hay
sudo -u www-data npm run db:migrate

# 6. Reiniciar servicio
systemctl restart docusignpro

# 7. Verificar que funciona
curl https://tudominio.com/api/health
```

### **Monitoreo de Rendimiento**
```bash
# Ver uso de recursos
htop

# Ver espacio en disco
df -h

# Ver logs de rendimiento
journalctl -u docusignpro | grep "SLOW REQUEST"

# Ver conexiones activas
netstat -an | grep :3000
```

---

## 🎯 **URLs de Acceso Post-Despliegue**

### **Frontend**
- **🌐 Sitio Principal**: https://tudominio.com
- **📊 Dashboard Admin**: https://tudominio.com/dashboard
- **🎥 RON Interface**: https://tudominio.com/ron

### **APIs**
- **📡 Health Check**: https://tudominio.com/api/health
- **📊 Métricas**: https://tudominio.com/api/metrics
- **📄 Documentos**: https://tudominio.com/api/documents
- **🎥 RON**: https://tudominio.com/api/ron
- **🆔 Verificación**: https://tudominio.com/api/identity

---

## 🔍 **Solución de Problemas**

### **Problema: Aplicación no inicia**
```bash
# Ver logs detallados
journalctl -u docusignpro -n 50

# Verificar variables de entorno
sudo -u www-data cat /var/www/docusignpro/.env

# Verificar permisos
ls -la /var/www/docusignpro/

# Probar manualmente
cd /var/www/docusignpro
sudo -u www-data node dist/production-server.js
```

### **Problema: Base de datos no conecta**
```bash
# Verificar PostgreSQL
systemctl status postgresql

# Probar conexión
psql -h localhost -U docusign_user docusignpro -c "SELECT 1;"

# Ver logs de PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log
```

### **Problema: Nginx no funciona**
```bash
# Verificar configuración
nginx -t

# Ver logs de Nginx
tail -f /var/log/nginx/error.log

# Reiniciar Nginx
systemctl restart nginx
```

### **Problema: SSL no funciona**
```bash
# Verificar certificados
certbot certificates

# Renovar certificados
certbot renew

# Ver logs de Certbot
tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## 🎉 **Verificación Final**

### **Checklist Post-Despliegue**
- [ ] ✅ Aplicación responde en https://tudominio.com/api/health
- [ ] ✅ Dashboard accesible en https://tudominio.com/dashboard
- [ ] ✅ RON funciona en https://tudominio.com/ron
- [ ] ✅ Base de datos conectada correctamente
- [ ] ✅ SSL/HTTPS funcionando
- [ ] ✅ Logs del sistema funcionando
- [ ] ✅ Backup automático configurado
- [ ] ✅ Monitoreo activo
- [ ] ✅ Usuario administrador creado
- [ ] ✅ Credenciales de servicios configuradas

### **Test de Funcionalidad**
```bash
# 1. Health check
curl https://tudominio.com/api/health

# 2. Plantillas de documentos
curl https://tudominio.com/api/documents/templates

# 3. Notarios disponibles
curl https://tudominio.com/api/notaries

# 4. Proveedores de pago
curl https://tudominio.com/api/payments/providers
```

---

## 📞 **Soporte Post-Despliegue**

### **Contactos Importantes**
- **Logs de aplicación**: `journalctl -u docusignpro -f`
- **Configuración**: `/var/www/docusignpro/.env`
- **Backups**: `/backups/docusignpro/`
- **Credenciales admin**: `/root/docusignpro_admin_credentials.txt`

### **Comandos de Emergencia**
```bash
# Reiniciar todo
systemctl restart docusignpro nginx postgresql

# Modo de mantenimiento
systemctl stop docusignpro
# Mostrar página de mantenimiento en Nginx

# Restaurar desde backup
# Ver sección "Backup y Recuperación" arriba
```

---

## 🎉 **¡DESPLIEGUE COMPLETADO!**

**Tu plataforma DocuSignPro Complete está ahora en producción, lista para:**

- ✅ **Recibir usuarios reales**
- ✅ **Procesar documentos legales**
- ✅ **Realizar sesiones RON**
- ✅ **Gestionar pagos**
- ✅ **Verificar identidades**
- ✅ **Generar certificados notariales**

### **🌐 Acceso a tu Plataforma:**
**https://tudominio.com**

**¡Felicidades! Tu plataforma empresarial está lista para competir en el mercado.** 🚀