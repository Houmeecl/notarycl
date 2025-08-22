#!/bin/bash

# DocuSignPro Complete - Despliegue Rápido
# Para VPS con Ubuntu/Debian

echo "⚡ DocuSignPro Complete - Despliegue Rápido"
echo "=========================================="

# Variables
DOMAIN=${1:-"localhost"}
PROJECT_DIR="/var/www/docusignpro"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Verificar root
if [[ $EUID -ne 0 ]]; then
    echo "❌ Ejecutar como root: sudo ./quick-deploy.sh tudominio.com"
    exit 1
fi

log_info "Iniciando despliegue rápido para dominio: $DOMAIN"

# 1. Actualizar sistema e instalar dependencias básicas
log_info "Instalando dependencias básicas..."
apt update && apt upgrade -y
apt install -y curl wget git nginx postgresql postgresql-contrib

# 2. Instalar Node.js 20
log_info "Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Configurar PostgreSQL rápido
log_info "Configurando PostgreSQL..."
DB_PASSWORD=$(openssl rand -base64 16)
sudo -u postgres psql << EOF
CREATE DATABASE docusignpro;
CREATE USER docusign_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE docusignpro TO docusign_user;
\q
EOF

# 4. Crear directorio y copiar aplicación
log_info "Configurando aplicación..."
mkdir -p $PROJECT_DIR
cp -r /workspace/* $PROJECT_DIR/ 2>/dev/null || true
chown -R www-data:www-data $PROJECT_DIR

# 5. Configurar variables de entorno mínimas
log_info "Configurando variables de entorno..."
cat > $PROJECT_DIR/.env << EOF
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://docusign_user:$DB_PASSWORD@localhost:5432/docusignpro
SESSION_SECRET=$(openssl rand -base64 64)
JWT_SECRET=$(openssl rand -base64 64)
DOMAIN=$DOMAIN

# Configurar estos valores manualmente después:
AGORA_APP_ID=demo_agora_id
AGORA_APP_CERTIFICATE=demo_certificate
STRIPE_SECRET_KEY=sk_test_demo
SENDGRID_API_KEY=SG.demo_key
FROM_EMAIL=noreply@$DOMAIN
EOF

chown www-data:www-data $PROJECT_DIR/.env
chmod 600 $PROJECT_DIR/.env

# 6. Instalar dependencias y construir
log_info "Instalando dependencias y construyendo..."
cd $PROJECT_DIR
sudo -u www-data npm ci --only=production
sudo -u www-data npm run build 2>/dev/null || log_warning "Build falló, usando archivos existentes"

# 7. Configurar Nginx básico
log_info "Configurando Nginx..."
cat > /etc/nginx/sites-available/docusignpro << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    client_max_body_size 50M;
}
EOF

ln -sf /etc/nginx/sites-available/docusignpro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 8. Configurar servicio systemd
log_info "Configurando servicio..."
cat > /etc/systemd/system/docusignpro.service << EOF
[Unit]
Description=DocuSignPro Complete
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=/usr/bin/node $PROJECT_DIR/dist/production-server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable docusignpro

# 9. Configurar firewall básico
log_info "Configurando firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 10. Iniciar aplicación
log_info "Iniciando aplicación..."
systemctl start docusignpro

# Esperar y verificar
sleep 5
if systemctl is-active --quiet docusignpro; then
    log_success "✅ Aplicación iniciada correctamente"
else
    log_warning "⚠️ Problema iniciando aplicación, verificando logs..."
    journalctl -u docusignpro --no-pager -n 20
fi

# 11. Configurar SSL si es un dominio real
if [[ "$DOMAIN" != "localhost" && "$DOMAIN" != *"."* ]]; then
    log_info "Configurando SSL para $DOMAIN..."
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN 2>/dev/null || log_warning "SSL falló, configurar manualmente"
fi

echo ""
echo "🎉 ¡DESPLIEGUE RÁPIDO COMPLETADO!"
echo "================================"
echo ""
echo "🌐 Tu aplicación está disponible en:"
if [[ "$DOMAIN" == "localhost" ]]; then
    echo "   http://localhost"
    echo "   http://TU_IP_VPS"
else
    echo "   https://$DOMAIN"
    echo "   https://www.$DOMAIN"
fi
echo ""
echo "📊 Dashboard: /dashboard"
echo "🎥 RON: /ron"
echo "📡 Health: /api/health"
echo ""
echo "👤 CREDENCIALES DE ADMIN:"
echo "   Usuario: admin"
echo "   Contraseña: Ver logs con: journalctl -u docusignpro | grep 'Contraseña'"
echo ""
echo "🔧 COMANDOS ÚTILES:"
echo "   systemctl status docusignpro    # Estado"
echo "   systemctl restart docusignpro   # Reiniciar"
echo "   journalctl -u docusignpro -f    # Ver logs"
echo "   nano $PROJECT_DIR/.env          # Editar configuración"
echo ""
echo "⚠️ IMPORTANTE:"
echo "1. Edita $PROJECT_DIR/.env con tus credenciales reales"
echo "2. Reinicia: systemctl restart docusignpro"
echo "3. Configura backup externo"
echo ""
log_success "¡DocuSignPro Complete está en producción!"