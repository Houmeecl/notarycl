#!/bin/bash

# Script de desarrollo para DocuSignPro
# Facilita el trabajo con el proyecto

echo "🚀 DocuSignPro - Script de Desarrollo"
echo "======================================"

# Función para mostrar el menú
show_menu() {
    echo ""
    echo "Opciones disponibles:"
    echo "1. 🏃 Iniciar servidor de desarrollo"
    echo "2. 🧪 Abrir página de pruebas"
    echo "3. 📊 Ver estadísticas del servidor"
    echo "4. 👥 Listar usuarios"
    echo "5. 🔍 Verificar estado del servidor"
    echo "6. 📝 Crear usuario de prueba"
    echo "7. 🛠️ Verificar dependencias"
    echo "8. 🧹 Limpiar y reiniciar"
    echo "9. ❌ Salir"
    echo ""
}

# Función para verificar si el servidor está ejecutándose
check_server() {
    if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Función para iniciar el servidor
start_server() {
    echo "🏃 Iniciando servidor de desarrollo..."
    
    if check_server; then
        echo "⚠️  El servidor ya está ejecutándose en puerto 5000"
        return
    fi
    
    echo "📦 Instalando dependencias si es necesario..."
    npm install --silent
    
    echo "🚀 Iniciando servidor..."
    npm run dev-minimal &
    
    echo "⏳ Esperando que el servidor inicie..."
    sleep 5
    
    if check_server; then
        echo "✅ ¡Servidor iniciado exitosamente!"
        echo "🌐 URL: http://localhost:5000"
        echo "🧪 Pruebas: http://localhost:5000/test"
    else
        echo "❌ Error: El servidor no pudo iniciarse"
    fi
}

# Función para abrir página de pruebas
open_test_page() {
    if check_server; then
        echo "🧪 Abriendo página de pruebas..."
        echo "URL: http://localhost:5000/test"
        
        # Intentar abrir en el navegador si está disponible
        if command -v xdg-open > /dev/null; then
            xdg-open http://localhost:5000/test
        elif command -v open > /dev/null; then
            open http://localhost:5000/test
        else
            echo "💡 Abre manualmente: http://localhost:5000/test"
        fi
    else
        echo "❌ El servidor no está ejecutándose. Usa la opción 1 para iniciarlo."
    fi
}

# Función para ver estadísticas
show_stats() {
    if check_server; then
        echo "📊 Estadísticas del servidor:"
        curl -s http://localhost:5000/api/stats | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5000/api/stats
    else
        echo "❌ El servidor no está ejecutándose."
    fi
}

# Función para listar usuarios
list_users() {
    if check_server; then
        echo "👥 Usuarios registrados:"
        curl -s http://localhost:5000/api/users | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5000/api/users
    else
        echo "❌ El servidor no está ejecutándose."
    fi
}

# Función para verificar estado
check_status() {
    echo "🔍 Verificando estado del servidor..."
    if check_server; then
        echo "✅ Servidor ejecutándose correctamente"
        curl -s http://localhost:5000/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:5000/api/health
    else
        echo "❌ Servidor no disponible en puerto 5000"
    fi
}

# Función para crear usuario de prueba
create_test_user() {
    if check_server; then
        echo "📝 Creando usuario de prueba..."
        
        USERNAME="demo$(date +%s)"
        
        RESULT=$(curl -s -X POST http://localhost:5000/api/register \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$USERNAME\",\"password\":\"demo123\",\"email\":\"$USERNAME@test.com\",\"fullName\":\"Usuario Demo $USERNAME\"}")
        
        echo "Resultado:"
        echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
    else
        echo "❌ El servidor no está ejecutándose."
    fi
}

# Función para verificar dependencias
check_dependencies() {
    echo "🛠️ Verificando dependencias..."
    
    # Verificar Node.js
    if command -v node > /dev/null; then
        echo "✅ Node.js: $(node --version)"
    else
        echo "❌ Node.js no encontrado"
    fi
    
    # Verificar npm
    if command -v npm > /dev/null; then
        echo "✅ npm: $(npm --version)"
    else
        echo "❌ npm no encontrado"
    fi
    
    # Verificar tsx
    if command -v tsx > /dev/null; then
        echo "✅ tsx disponible"
    else
        echo "⚠️  tsx no encontrado globalmente, usando versión local"
    fi
    
    # Verificar package.json
    if [ -f "package.json" ]; then
        echo "✅ package.json encontrado"
        echo "📦 Dependencias instaladas: $(npm list --depth=0 2>/dev/null | grep -c "├\|└" || echo "verificando...")"
    else
        echo "❌ package.json no encontrado"
    fi
}

# Función para limpiar y reiniciar
clean_restart() {
    echo "🧹 Limpiando y reiniciando..."
    
    # Terminar procesos del servidor
    echo "🛑 Terminando procesos del servidor..."
    pkill -f "minimal-server" 2>/dev/null || echo "No hay procesos para terminar"
    
    # Limpiar cache
    echo "🗑️ Limpiando cache..."
    rm -rf node_modules/.cache 2>/dev/null || true
    
    # Reinstalar dependencias
    echo "📦 Reinstalando dependencias..."
    npm install --silent
    
    echo "✅ Limpieza completada. Usa la opción 1 para iniciar el servidor."
}

# Bucle principal del menú
while true; do
    show_menu
    read -p "Selecciona una opción (1-9): " choice
    
    case $choice in
        1) start_server ;;
        2) open_test_page ;;
        3) show_stats ;;
        4) list_users ;;
        5) check_status ;;
        6) create_test_user ;;
        7) check_dependencies ;;
        8) clean_restart ;;
        9) echo "👋 ¡Hasta luego!"; exit 0 ;;
        *) echo "❌ Opción inválida. Por favor selecciona 1-9." ;;
    esac
    
    echo ""
    read -p "Presiona Enter para continuar..."
done