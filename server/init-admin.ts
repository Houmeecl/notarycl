import { storage } from "./storage";
import { hashPassword } from "./auth";
import { generateRandomPassword } from "@shared/utils/password-util";

/**
 * Inicializa el primer administrador del sistema de forma segura
 * Solo se ejecuta si no existe ningún usuario administrador
 */
export async function initializeFirstAdmin() {
  try {
    // Verificar si ya existe un administrador
    const existingAdmin = storage.users.find(u => u.role === "admin");
    
    if (existingAdmin) {
      console.log("✅ Ya existe un administrador en el sistema");
      return;
    }

    // Generar credenciales seguras para el primer admin
    const adminUsername = "admin";
    const adminPassword = generateRandomPassword(16);
    const hashedPassword = await hashPassword(adminPassword);

    // Crear el primer administrador
    storage.users.push({
      id: Date.now(),
      username: adminUsername,
      password: hashedPassword,
      email: "admin@docusignpro.com",
      fullName: "Administrador Principal",
      role: "admin",
      platform: "notarypro",
      createdAt: new Date(),
      region: null,
      address: null,
      businessName: null,
      comuna: null,
      phone: null
    });

    console.log("🎉 PRIMER ADMINISTRADOR CREADO EXITOSAMENTE");
    console.log("📋 CREDENCIALES DE ACCESO:");
    console.log(`   Usuario: ${adminUsername}`);
    console.log(`   Contraseña: ${adminPassword}`);
    console.log("⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro");
    console.log("⚠️  Cambia la contraseña después del primer login");
    
  } catch (error) {
    console.error("❌ Error creando el primer administrador:", error);
  }
}

/**
 * Crea un usuario administrador con credenciales específicas
 * Solo para uso en desarrollo
 */
export async function createDevelopmentAdmin(username: string, password: string, email: string) {
  try {
    const existingUser = storage.users.find(u => u.username === username);
    
    if (existingUser) {
      console.log(`⚠️  El usuario ${username} ya existe`);
      return;
    }

    const hashedPassword = await hashPassword(password);
    
    storage.users.push({
      id: Date.now(),
      username,
      password: hashedPassword,
      email,
      fullName: `Admin ${username}`,
      role: "admin",
      platform: "notarypro",
      createdAt: new Date(),
      region: null,
      address: null,
      businessName: null,
      comuna: null,
      phone: null
    });

    console.log(`✅ Usuario de desarrollo ${username} creado exitosamente`);
    
  } catch (error) {
    console.error(`❌ Error creando usuario de desarrollo ${username}:`, error);
  }
}