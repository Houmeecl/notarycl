#!/bin/bash

# DocuSignPro Complete - Script de Despliegue Automático
# Para Ubuntu 20.04+ / Debian 11+

set -e  # Salir si hay errores

echo "🚀 DocuSignPro Complete - Despliegue Automático"
echo "=================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
PROJECT_NAME="docusignpro"
PROJECT_DIR="/var/www/$PROJECT_NAME"
NGINX_CONF="/etc/nginx/sites-available/$PROJECT_NAME"
SYSTEMD_SERVICE="/etc/systemd/system/$PROJECT_NAME.service"
DB_NAME="docusignpro"
DB_USER="docusign_user"
DOMAIN=${1:-"tudominio.com"}  # Primer argumento o valor por defecto

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que se ejecuta como root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root (sudo)"
        exit 1
    fi
}

# Actualizar sistema
update_system() {
    log_info "Actualizando sistema operativo..."
    apt update && apt upgrade -y
    log_success "Sistema actualizado"
}

# Instalar Node.js
install_nodejs() {
    log_info "Instalando Node.js 20 LTS..."
    
    # Instalar NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    apt-get install -y nodejs
    
    # Verificar instalación
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    log_success "Node.js $node_version y npm $npm_version instalados"
}

# Instalar PostgreSQL
install_postgresql() {
    log_info "Instalando PostgreSQL..."
    
    apt-get install -y postgresql postgresql-contrib
    
    # Iniciar y habilitar PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    log_success "PostgreSQL instalado y habilitado"
}

# Configurar base de datos
setup_database() {
    log_info "Configurando base de datos..."
    
    # Generar contraseña segura para la DB
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Crear usuario y base de datos
    sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
\q
EOF
    
    # Guardar credenciales
    echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" > /tmp/db_credentials.env
    
    log_success "Base de datos configurada. Credenciales guardadas en /tmp/db_credentials.env"
}

# Instalar Nginx
install_nginx() {
    log_info "Instalando Nginx..."
    
    apt-get install -y nginx
    
    # Habilitar Nginx
    systemctl enable nginx
    systemctl start nginx
    
    log_success "Nginx instalado y habilitado"
}

# Instalar PM2 para gestión de procesos
install_pm2() {
    log_info "Instalando PM2..."
    
    npm install -g pm2
    
    # Configurar PM2 para iniciar con el sistema
    pm2 startup systemd -u www-data --hp /var/www
    
    log_success "PM2 instalado"
}

# Instalar certificados SSL con Certbot
install_ssl() {
    log_info "Instalando Certbot para SSL..."
    
    apt-get install -y certbot python3-certbot-nginx
    
    log_success "Certbot instalado"
}

# Crear usuario del sistema
create_system_user() {
    log_info "Creando usuario del sistema..."
    
    # Crear usuario si no existe
    if ! id "www-data" &>/dev/null; then
        useradd -r -s /bin/bash -d /var/www www-data
    fi
    
    # Crear directorio del proyecto
    mkdir -p $PROJECT_DIR
    chown -R www-data:www-data $PROJECT_DIR
    
    log_success "Usuario del sistema configurado"
}

# Configurar firewall
setup_firewall() {
    log_info "Configurando firewall..."
    
    # Instalar UFW si no está instalado
    apt-get install -y ufw
    
    # Configurar reglas básicas
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    
    # Permitir SSH, HTTP, HTTPS
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Habilitar firewall
    ufw --force enable
    
    log_success "Firewall configurado"
}

# Configurar Nginx
setup_nginx() {
    log_info "Configurando Nginx..."
    
    cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirigir HTTP a HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # Configuración SSL (se configurará con Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Configuración de seguridad
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Logs
    access_log /var/log/nginx/$PROJECT_NAME.access.log;
    error_log /var/log/nginx/$PROJECT_NAME.error.log;
    
    # Configuración del proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Archivos estáticos
    location /assets {
        alias $PROJECT_DIR/dist/public/assets;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Límites de subida para documentos
    client_max_body_size 50M;
}
EOF

    # Habilitar sitio
    ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Verificar configuración
    nginx -t
    
    log_success "Nginx configurado"
}

# Configurar servicio systemd
setup_systemd() {
    log_info "Configurando servicio systemd..."
    
    cat > $SYSTEMD_SERVICE << EOF
[Unit]
Description=DocuSignPro Complete - Enterprise Document Management
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=/usr/bin/node $PROJECT_DIR/dist/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$PROJECT_NAME

# Límites de recursos
LimitNOFILE=65536
LimitNPROC=4096

# Seguridad
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$PROJECT_DIR /tmp /var/log/$PROJECT_NAME

[Install]
WantedBy=multi-user.target
EOF

    # Recargar systemd
    systemctl daemon-reload
    systemctl enable $PROJECT_NAME
    
    log_success "Servicio systemd configurado"
}

# Configurar logs
setup_logging() {
    log_info "Configurando sistema de logs..."
    
    # Crear directorios de logs
    mkdir -p /var/log/$PROJECT_NAME
    chown -R www-data:www-data /var/log/$PROJECT_NAME
    
    # Configurar logrotate
    cat > /etc/logrotate.d/$PROJECT_NAME << EOF
/var/log/$PROJECT_NAME/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload $PROJECT_NAME
    endscript
}
EOF
    
    log_success "Sistema de logs configurado"
}

# Configurar backup automático
setup_backup() {
    log_info "Configurando sistema de backup..."
    
    # Crear directorio de backups
    mkdir -p /backups/$PROJECT_NAME
    chown -R www-data:www-data /backups/$PROJECT_NAME
    
    # Script de backup
    cat > /usr/local/bin/${PROJECT_NAME}_backup.sh << 'EOF'
#!/bin/bash

PROJECT_NAME="docusignpro"
BACKUP_DIR="/backups/$PROJECT_NAME"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="docusignpro"

# Backup de base de datos
pg_dump -h localhost -U docusign_user $DB_NAME > "$BACKUP_DIR/db_backup_$DATE.sql"

# Backup de archivos de aplicación
tar -czf "$BACKUP_DIR/app_backup_$DATE.tar.gz" -C /var/www/$PROJECT_NAME .

# Limpiar backups antiguos (más de 30 días)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completado: $DATE"
EOF

    chmod +x /usr/local/bin/${PROJECT_NAME}_backup.sh
    
    # Configurar cron para backup diario a las 2 AM
    echo "0 2 * * * /usr/local/bin/${PROJECT_NAME}_backup.sh" | crontab -u www-data -
    
    log_success "Sistema de backup configurado"
}

# Función principal de instalación
main() {
    log_info "Iniciando instalación de DocuSignPro Complete..."
    
    check_root
    update_system
    install_nodejs
    install_postgresql
    setup_database
    install_nginx
    install_pm2
    install_ssl
    create_system_user
    setup_firewall
    setup_nginx
    setup_systemd
    setup_logging
    setup_backup
    
    log_success "¡Instalación base completada!"
    echo ""
    echo "🎯 PRÓXIMOS PASOS:"
    echo "1. Subir código del proyecto a $PROJECT_DIR"
    echo "2. Configurar variables de entorno (.env)"
    echo "3. Ejecutar migraciones de base de datos"
    echo "4. Construir aplicación (npm run build)"
    echo "5. Configurar SSL con certbot"
    echo "6. Iniciar servicio"
    echo ""
    echo "📋 CREDENCIALES DE BASE DE DATOS:"
    cat /tmp/db_credentials.env
    echo ""
    echo "🔧 Para continuar, ejecuta:"
    echo "   ./deploy-app.sh $DOMAIN"
}

# Ejecutar si es llamado directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi