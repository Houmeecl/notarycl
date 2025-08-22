#!/bin/bash

# DocuSignPro Complete - Script de Despliegue de Aplicación
# Ejecutar después del script de instalación base

set -e

echo "📦 DocuSignPro Complete - Despliegue de Aplicación"
echo "================================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables
PROJECT_NAME="docusignpro"
PROJECT_DIR="/var/www/$PROJECT_NAME"
REPO_URL="https://github.com/tu-usuario/docusignpro.git"  # Cambiar por tu repo
DOMAIN=${1:-"tudominio.com"}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar que se ejecuta como root
if [[ $EUID -ne 0 ]]; then
    log_error "Este script debe ejecutarse como root (sudo)"
    exit 1
fi

# Función para clonar o actualizar código
deploy_code() {
    log_info "Desplegando código de la aplicación..."
    
    if [ -d "$PROJECT_DIR/.git" ]; then
        # Actualizar código existente
        cd $PROJECT_DIR
        sudo -u www-data git pull origin main
        log_info "Código actualizado desde repositorio"
    else
        # Clonar repositorio
        log_warning "Clonando desde repositorio (cambiar REPO_URL en el script)"
        log_warning "Por ahora, copiando archivos locales..."
        
        # Copiar archivos del proyecto actual
        cp -r /workspace/* $PROJECT_DIR/ 2>/dev/null || true
        chown -R www-data:www-data $PROJECT_DIR
        
        log_info "Código copiado al directorio de producción"
    fi
}

# Configurar variables de entorno de producción
setup_production_env() {
    log_info "Configurando variables de entorno de producción..."
    
    # Leer credenciales de base de datos
    if [ -f "/tmp/db_credentials.env" ]; then
        DB_URL=$(cat /tmp/db_credentials.env)
    else
        log_error "Credenciales de base de datos no encontradas"
        exit 1
    fi
    
    # Generar secretos seguros
    SESSION_SECRET=$(openssl rand -base64 64)
    JWT_SECRET=$(openssl rand -base64 64)
    
    # Crear archivo .env de producción
    cat > $PROJECT_DIR/.env << EOF
# DocuSignPro Complete - Producción
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Base de datos
$DB_URL

# Seguridad
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET

# Dominio
DOMAIN=$DOMAIN
API_URL=https://api.$DOMAIN
FRONTEND_URL=https://$DOMAIN

# ⚠️ CONFIGURAR ESTOS VALORES CON CREDENCIALES REALES:

# Agora.io (Videollamadas RON)
AGORA_APP_ID=TU_AGORA_APP_ID
AGORA_APP_CERTIFICATE=TU_AGORA_CERTIFICATE
VITE_AGORA_APP_ID=TU_AGORA_APP_ID

# Stripe
STRIPE_SECRET_KEY=sk_live_TU_STRIPE_SECRET
STRIPE_PUBLISHABLE_KEY=pk_live_TU_STRIPE_PUBLIC
STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET

# PayPal
PAYPAL_CLIENT_ID=TU_PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET=TU_PAYPAL_SECRET
PAYPAL_MODE=live

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=TU_MERCADOPAGO_TOKEN
MERCADOPAGO_PUBLIC_KEY=TU_MERCADOPAGO_PUBLIC

# SendGrid (Email)
SENDGRID_API_KEY=SG.TU_SENDGRID_KEY
FROM_EMAIL=noreply@$DOMAIN
SUPPORT_EMAIL=soporte@$DOMAIN

# OpenAI
OPENAI_API_KEY=sk-TU_OPENAI_KEY

# Configuración de logs
LOG_LEVEL=info
LOG_FILE=/var/log/$PROJECT_NAME/app.log
ERROR_LOG_FILE=/var/log/$PROJECT_NAME/error.log

# RON Configuration
RON_ENABLED=true
RON_RECORDING_REQUIRED=true
RON_MAX_SESSION_DURATION=7200

# Seguridad
RATE_LIMIT_ENABLED=true
IP_BLOCKING_ENABLED=true
AUTO_BLOCK_THRESHOLD=20

# Backup
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
EOF

    chown www-data:www-data $PROJECT_DIR/.env
    chmod 600 $PROJECT_DIR/.env
    
    log_success "Variables de entorno configuradas"
    log_warning "⚠️ IMPORTANTE: Edita $PROJECT_DIR/.env con tus credenciales reales"
}

# Instalar dependencias y construir
build_application() {
    log_info "Instalando dependencias y construyendo aplicación..."
    
    cd $PROJECT_DIR
    
    # Instalar dependencias como www-data
    sudo -u www-data npm ci --only=production
    
    # Construir aplicación
    sudo -u www-data npm run build
    
    log_success "Aplicación construida exitosamente"
}

# Migrar base de datos
migrate_database() {
    log_info "Ejecutando migraciones de base de datos..."
    
    cd $PROJECT_DIR
    
    # Ejecutar migraciones de Drizzle
    sudo -u www-data npm run db:push
    
    log_success "Migraciones de base de datos completadas"
}

# Configurar SSL con Let's Encrypt
setup_ssl_certificates() {
    log_info "Configurando certificados SSL..."
    
    # Obtener certificado SSL
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    # Configurar renovación automática
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    log_success "Certificados SSL configurados"
}

# Iniciar servicios
start_services() {
    log_info "Iniciando servicios..."
    
    # Reiniciar Nginx con nueva configuración
    systemctl restart nginx
    
    # Iniciar aplicación
    systemctl start $PROJECT_NAME
    
    # Verificar estado
    sleep 5
    if systemctl is-active --quiet $PROJECT_NAME; then
        log_success "Aplicación iniciada exitosamente"
    else
        log_error "Error iniciando aplicación"
        systemctl status $PROJECT_NAME
        exit 1
    fi
    
    if systemctl is-active --quiet nginx; then
        log_success "Nginx funcionando correctamente"
    else
        log_error "Error con Nginx"
        systemctl status nginx
        exit 1
    fi
}

# Verificar despliegue
verify_deployment() {
    log_info "Verificando despliegue..."
    
    # Verificar que la aplicación responde
    if curl -f -s https://$DOMAIN/api/health > /dev/null; then
        log_success "✅ Aplicación respondiendo correctamente en https://$DOMAIN"
    else
        log_warning "⚠️ Aplicación no responde en HTTPS, verificando HTTP..."
        if curl -f -s http://localhost:3000/api/health > /dev/null; then
            log_info "Aplicación funciona localmente, verificar configuración de Nginx/SSL"
        else
            log_error "❌ Aplicación no responde"
            exit 1
        fi
    fi
    
    # Verificar base de datos
    if sudo -u www-data psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "✅ Base de datos conectada correctamente"
    else
        log_error "❌ Error de conexión a base de datos"
    fi
}

# Crear usuario administrador inicial
create_admin_user() {
    log_info "Configurando usuario administrador inicial..."
    
    cd $PROJECT_DIR
    
    # Script para crear admin (se ejecutará una vez)
    cat > /tmp/create_admin.js << 'EOF'
const { simpleStorage } = require('./server/simple-storage');
const { hashPassword } = require('./server/simple-auth');

async function createAdmin() {
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!@#';
    const hashedPassword = await hashPassword(adminPassword);
    
    const admin = {
        id: Date.now(),
        username: 'admin',
        password: hashedPassword,
        email: process.env.ADMIN_EMAIL || 'admin@' + process.env.DOMAIN,
        fullName: 'Administrador Principal',
        role: 'admin',
        platform: 'notarypro',
        createdAt: new Date()
    };
    
    console.log('👤 Administrador creado:');
    console.log('   Usuario: admin');
    console.log('   Email:', admin.email);
    console.log('   Contraseña:', adminPassword);
    console.log('⚠️ CAMBIAR CONTRASEÑA DESPUÉS DEL PRIMER LOGIN');
}

createAdmin().catch(console.error);
EOF
    
    # Generar contraseña de admin
    ADMIN_PASSWORD=$(openssl rand -base64 12)
    
    echo "👤 CREDENCIALES DE ADMINISTRADOR:"
    echo "   Usuario: admin"
    echo "   Email: admin@$DOMAIN"
    echo "   Contraseña: $ADMIN_PASSWORD"
    echo ""
    echo "⚠️ IMPORTANTE: Guarda estas credenciales en un lugar seguro"
    echo "⚠️ Cambia la contraseña después del primer login"
    
    # Guardar credenciales en archivo seguro
    echo "admin:$ADMIN_PASSWORD" > /root/docusignpro_admin_credentials.txt
    chmod 600 /root/docusignpro_admin_credentials.txt
}

# Configurar monitoreo básico
setup_monitoring() {
    log_info "Configurando monitoreo básico..."
    
    # Script de monitoreo de salud
    cat > /usr/local/bin/${PROJECT_NAME}_health_check.sh << EOF
#!/bin/bash

PROJECT_NAME="$PROJECT_NAME"
DOMAIN="$DOMAIN"
LOG_FILE="/var/log/\$PROJECT_NAME/health_check.log"

# Verificar aplicación
if curl -f -s https://\$DOMAIN/api/health > /dev/null; then
    echo "\$(date): ✅ Aplicación OK" >> \$LOG_FILE
else
    echo "\$(date): ❌ Aplicación DOWN" >> \$LOG_FILE
    # Reintentar reiniciar servicio
    systemctl restart \$PROJECT_NAME
fi

# Verificar espacio en disco
DISK_USAGE=\$(df / | tail -1 | awk '{print \$5}' | sed 's/%//')
if [ \$DISK_USAGE -gt 85 ]; then
    echo "\$(date): ⚠️ Espacio en disco bajo: \$DISK_USAGE%" >> \$LOG_FILE
fi

# Verificar memoria
MEM_USAGE=\$(free | grep Mem | awk '{printf("%.0f", \$3/\$2 * 100.0)}')
if [ \$MEM_USAGE -gt 90 ]; then
    echo "\$(date): ⚠️ Memoria alta: \$MEM_USAGE%" >> \$LOG_FILE
fi
EOF

    chmod +x /usr/local/bin/${PROJECT_NAME}_health_check.sh
    
    # Ejecutar cada 5 minutos
    echo "*/5 * * * * /usr/local/bin/${PROJECT_NAME}_health_check.sh" | crontab -
    
    log_success "Monitoreo básico configurado"
}

# Función principal
main() {
    log_info "Desplegando DocuSignPro Complete..."
    
    deploy_code
    setup_production_env
    build_application
    migrate_database
    setup_ssl_certificates
    start_services
    verify_deployment
    create_admin_user
    setup_monitoring
    
    echo ""
    echo "🎉 ¡DESPLIEGUE COMPLETADO EXITOSAMENTE!"
    echo "======================================"
    echo ""
    echo "🌐 Tu aplicación está disponible en:"
    echo "   https://$DOMAIN"
    echo "   https://www.$DOMAIN"
    echo ""
    echo "📊 Panel de administración:"
    echo "   https://$DOMAIN/dashboard"
    echo ""
    echo "🎥 Módulo RON:"
    echo "   https://$DOMAIN/ron"
    echo ""
    echo "👤 Credenciales de administrador:"
    echo "   Ver: /root/docusignpro_admin_credentials.txt"
    echo ""
    echo "📋 SIGUIENTES PASOS:"
    echo "1. Configurar credenciales reales en $PROJECT_DIR/.env"
    echo "2. Reiniciar servicio: systemctl restart $PROJECT_NAME"
    echo "3. Verificar logs: journalctl -u $PROJECT_NAME -f"
    echo "4. Configurar backup externo"
    echo "5. Configurar monitoreo avanzado"
    echo ""
    echo "🔧 COMANDOS ÚTILES:"
    echo "   systemctl status $PROJECT_NAME     # Estado del servicio"
    echo "   systemctl restart $PROJECT_NAME    # Reiniciar aplicación"
    echo "   nginx -t                          # Verificar configuración Nginx"
    echo "   certbot renew                     # Renovar certificados SSL"
    echo "   /usr/local/bin/${PROJECT_NAME}_backup.sh  # Ejecutar backup manual"
    echo ""
    log_success "¡DocuSignPro Complete está en producción!"
}

# Ejecutar
main "$@"