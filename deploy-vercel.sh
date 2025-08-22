#!/bin/bash

# DocuSignPro Complete - Script de Despliegue Automático a Vercel
echo "🚀 DocuSignPro Complete - Despliegue a Vercel"
echo "============================================="

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Variables
PROJECT_NAME=${1:-"docusignpro-complete-demo"}
GITHUB_REPO=${2:-""}

# Verificar dependencias
check_dependencies() {
    log_info "Verificando dependencias..."
    
    if ! command -v git &> /dev/null; then
        log_error "Git no está instalado"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm no está instalado"
        exit 1
    fi
    
    log_success "Dependencias verificadas"
}

# Preparar archivos para Vercel
prepare_vercel_files() {
    log_info "Preparando archivos para Vercel..."
    
    # Asegurar que existen los directorios
    mkdir -p public api/demo api/documents api/payments
    
    # Copiar archivos HTML si no existen en public
    if [ ! -f "public/demo.html" ]; then
        cp demo.html public/ 2>/dev/null || log_warning "demo.html no encontrado"
    fi
    
    if [ ! -f "public/dashboard.html" ]; then
        cp dashboard.html public/ 2>/dev/null || log_warning "dashboard.html no encontrado"
    fi
    
    if [ ! -f "public/test-ron.html" ]; then
        cp test-ron.html public/ 2>/dev/null || log_warning "test-ron.html no encontrado"
    fi
    
    if [ ! -f "public/test-enhanced.html" ]; then
        cp test-enhanced.html public/ 2>/dev/null || log_warning "test-enhanced.html no encontrado"
    fi
    
    # Verificar que existen las funciones API
    if [ ! -f "api/health.ts" ]; then
        log_error "Funciones API no encontradas. Ejecutar desde el directorio del proyecto."
        exit 1
    fi
    
    log_success "Archivos preparados para Vercel"
}

# Instalar Vercel CLI si no está instalado
install_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        log_info "Instalando Vercel CLI..."
        npm install -g vercel
        log_success "Vercel CLI instalado"
    else
        log_info "Vercel CLI ya está instalado"
    fi
}

# Configurar Git si es necesario
setup_git() {
    if [ ! -d ".git" ]; then
        log_info "Inicializando repositorio Git..."
        git init
        git add .
        git commit -m "🎬 DocuSignPro Complete Demo - Ready for Vercel"
        git branch -M main
        log_success "Repositorio Git inicializado"
    else
        log_info "Repositorio Git ya existe"
        
        # Agregar cambios si los hay
        if [ -n "$(git status --porcelain)" ]; then
            log_info "Agregando cambios al repositorio..."
            git add .
            git commit -m "📦 Actualización para despliegue en Vercel - $(date)"
        fi
    fi
}

# Desplegar con Vercel CLI
deploy_to_vercel() {
    log_info "Desplegando a Vercel..."
    
    # Login si es necesario
    if ! vercel whoami &> /dev/null; then
        log_info "Iniciando sesión en Vercel..."
        vercel login
    fi
    
    # Desplegar
    log_info "Ejecutando despliegue..."
    if vercel --prod --yes --name="$PROJECT_NAME"; then
        log_success "¡Despliegue exitoso!"
    else
        log_error "Error en el despliegue"
        exit 1
    fi
}

# Configurar GitHub (opcional)
setup_github() {
    if [ -n "$GITHUB_REPO" ]; then
        log_info "Configurando repositorio GitHub: $GITHUB_REPO"
        
        if ! git remote get-url origin &> /dev/null; then
            git remote add origin "$GITHUB_REPO"
            log_info "Subiendo a GitHub..."
            git push -u origin main
            log_success "Código subido a GitHub"
        else
            log_info "GitHub ya configurado"
        fi
    fi
}

# Verificar despliegue
verify_deployment() {
    log_info "Verificando despliegue..."
    
    # Obtener URL del proyecto
    PROJECT_URL=$(vercel ls | grep "$PROJECT_NAME" | awk '{print $2}' | head -1)
    
    if [ -n "$PROJECT_URL" ]; then
        log_success "✅ Demo desplegado exitosamente!"
        echo ""
        echo "🌐 URLs de tu demo:"
        echo "   📍 Principal: https://$PROJECT_URL"
        echo "   🎬 Demo: https://$PROJECT_URL/demo"
        echo "   📊 Dashboard: https://$PROJECT_URL/dashboard"
        echo "   🎥 RON: https://$PROJECT_URL/ron"
        echo "   📡 Health: https://$PROJECT_URL/api/health"
        echo ""
        echo "🔧 Gestión:"
        echo "   📊 Dashboard Vercel: https://vercel.com/dashboard"
        echo "   📈 Analytics: https://vercel.com/analytics"
        echo "   📋 Logs: vercel logs https://$PROJECT_URL"
        echo ""
        
        # Probar APIs
        log_info "Probando APIs..."
        if curl -f -s "https://$PROJECT_URL/api/health" > /dev/null; then
            log_success "✅ API funcionando correctamente"
        else
            log_warning "⚠️ API puede tardar unos minutos en estar disponible"
        fi
        
    else
        log_error "No se pudo obtener la URL del proyecto"
    fi
}

# Función principal
main() {
    echo "🎬 Iniciando despliegue de DocuSignPro Complete Demo..."
    echo "Proyecto: $PROJECT_NAME"
    echo ""
    
    check_dependencies
    prepare_vercel_files
    install_vercel_cli
    setup_git
    
    if [ -n "$GITHUB_REPO" ]; then
        setup_github
    fi
    
    deploy_to_vercel
    verify_deployment
    
    echo ""
    echo "🎉 ¡DESPLIEGUE COMPLETADO!"
    echo "========================"
    echo ""
    echo "🎭 Tu demo de DocuSignPro Complete está ahora LIVE en Vercel"
    echo ""
    echo "📋 Próximos pasos:"
    echo "1. 🌐 Visita tu demo en la URL proporcionada"
    echo "2. 🎬 Prueba los 3 escenarios de demo"
    echo "3. 📊 Explora el dashboard ejecutivo"
    echo "4. 🎥 Simula sesiones RON"
    echo "5. 📱 Comparte en redes sociales"
    echo ""
    echo "🔧 Comandos útiles:"
    echo "   vercel logs            # Ver logs"
    echo "   vercel domains         # Configurar dominio"
    echo "   vercel env             # Variables de entorno"
    echo "   vercel --prod          # Redesplegar"
    echo ""
    log_success "¡DocuSignPro Complete Demo está live en Vercel!"
}

# Mostrar ayuda
show_help() {
    echo "🚀 DocuSignPro Complete - Despliegue a Vercel"
    echo ""
    echo "Uso:"
    echo "  ./deploy-vercel.sh [nombre-proyecto] [github-repo]"
    echo ""
    echo "Ejemplos:"
    echo "  ./deploy-vercel.sh"
    echo "  ./deploy-vercel.sh mi-demo-docusign"
    echo "  ./deploy-vercel.sh mi-demo https://github.com/usuario/repo.git"
    echo ""
    echo "Opciones:"
    echo "  -h, --help     Mostrar esta ayuda"
    echo ""
}

# Verificar argumentos
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Ejecutar función principal
main