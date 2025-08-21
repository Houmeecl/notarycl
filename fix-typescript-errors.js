#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Script para corregir errores comunes de TypeScript en el proyecto
 */

const fixes = [
  // Agregar phone: null a objetos de usuario
  {
    pattern: /(\s+)(comuna: null)(\s*\n\s*}\);)/g,
    replacement: '$1$2,$3phone: null$4'
  },
  
  // Corregir req.user posiblemente undefined
  {
    pattern: /(const \w+ = req\.user\.id;)/g,
    replacement: 'if (!req.user) { return res.status(401).json({ message: "Usuario no autenticado" }); }\n    $1'
  },
  
  // Corregir error.message posiblemente undefined
  {
    pattern: /(error\.message)/g,
    replacement: '(error as Error).message'
  },
  
  // Corregir error.name posiblemente undefined
  {
    pattern: /(error\.name === 'ZodError')/g,
    replacement: '(error as any).name === \'ZodError\''
  },
  
  // Corregir error.errors posiblemente undefined
  {
    pattern: /(details: error\.errors)/g,
    replacement: 'details: (error as any).errors'
  }
];

function applyFixes(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    fixes.forEach(fix => {
      const newContent = content.replace(fix.pattern, fix.replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Corregido: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
  }
}

function findTypeScriptFiles(dir) {
  const files = [];
  
  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir);
    
    entries.forEach(entry => {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        scan(fullPath);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    });
  }
  
  scan(dir);
  return files;
}

// Ejecutar correcciones
console.log('🔧 Iniciando corrección de errores de TypeScript...');

const tsFiles = findTypeScriptFiles('./server');
tsFiles.forEach(applyFixes);

console.log('✅ Correcciones completadas');