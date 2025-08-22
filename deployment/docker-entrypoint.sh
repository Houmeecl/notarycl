#!/bin/sh

echo "🐳 DocuSignPro Complete - Docker Entrypoint"
echo "==========================================="

# Verificar variables de entorno críticas
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL no configurada"
    exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "❌ ERROR: SESSION_SECRET no configurada"
    exit 1
fi

# Esperar a que PostgreSQL esté disponible
echo "⏳ Esperando PostgreSQL..."
until pg_isready -h postgres -p 5432 -U docusign_user; do
    echo "PostgreSQL no disponible, esperando..."
    sleep 2
done
echo "✅ PostgreSQL disponible"

# Ejecutar migraciones de base de datos
echo "🗄️ Ejecutando migraciones de base de datos..."
npm run db:push || echo "⚠️ Migraciones fallaron, continuando..."

# Verificar que los archivos necesarios existen
if [ ! -f "./dist/production-server.js" ]; then
    echo "❌ ERROR: Archivo de servidor no encontrado"
    echo "Archivos disponibles:"
    ls -la ./dist/
    exit 1
fi

echo "🚀 Iniciando DocuSignPro Complete..."
echo "📡 Puerto: $PORT"
echo "🌐 Host: $HOST"
echo "🔒 Entorno: $NODE_ENV"
echo ""

# Iniciar aplicación
exec node ./dist/production-server.js