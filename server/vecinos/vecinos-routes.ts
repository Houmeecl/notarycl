import express from 'express';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import paymentsRouter from './payments-api';

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

const router = express.Router();

// Middleware para verificar el token JWT de Vecinos
const authenticateJWT = async (req: express.Request, res: express.Response, next: express.Function) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET || 'vecinos-secret');
      req.user = user;
      next();
    } catch (error) {
      return res.sendStatus(403);
    }
  } else {
    res.sendStatus(401);
  }
};

// Middleware para verificar si el usuario es un socio Vecinos
const isPartner = async (req: express.Request, res: express.Response, next: express.Function) => {
  if (!req.user || req.user.role !== 'partner') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de socio.' });
  }
  
  next();
};

// Middleware para verificar si el usuario es un vendedor
const isSeller = async (req: express.Request, res: express.Response, next: express.Function) => {
  if (!req.user || req.user.role !== 'seller') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de vendedor.' });
  }
  
  next();
};

// Middleware para verificar si el usuario es un supervisor
const isSupervisor = async (req: express.Request, res: express.Response, next: express.Function) => {
  if (!req.user || req.user.role !== 'supervisor') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de supervisor.' });
  }
  
  next();
};

// Iniciar sesión para Vecinos
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    console.log("Intento de login en vecinos con:", { username });
    
    // Buscar usuario por username usando MemStorage
    const user = storage.users.find(u => u.username === username);

    if (!user) {
      console.log("Usuario no encontrado:", username);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Verificar contraseña
    const isValid = await comparePasswords(password, user.password);
    
    if (!isValid) {
      console.log("Contraseña incorrecta para:", username);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    
    // Para demostración, creamos un perfil de socio sin consultar la base de datos
    let partnerProfile = null;
    if (user.role === 'partner') {
      // Perfil de socio simulado para evitar problemas con la estructura de la tabla
      partnerProfile = {
        id: 1,
        userId: user.id,
        storeName: "Minimarket El Sol",
        address: "Av. Providencia 1234, Santiago",
        phone: "+56 9 1234 5678",
        code: "LOCAL-XP125",
        status: "active"
      };
    }
    
    // Crear token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        partnerId: partnerProfile?.id || null 
      },
      process.env.JWT_SECRET || 'vecinos-secret',
      { expiresIn: '24h' }
    );
    
    // Enviar respuesta
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        partnerProfile
      }
    });
  } catch (error: any) {
    console.error('Error en login de Vecinos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para verificar el token y obtener información del usuario
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      platform: users.platform,
      createdAt: users.createdAt
    }).from(users).where(
      eq(users.id, req.user.id)
    ).limit(1);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Para demostración, creamos un perfil de socio sin consultar la base de datos
    let partnerProfile = null;
    if (user.role === 'partner') {
      // Perfil de socio simulado para evitar problemas con la estructura de la tabla
      partnerProfile = {
        id: 1,
        userId: user.id,
        storeName: "Minimarket El Sol",
        address: "Av. Providencia 1234, Santiago",
        phone: "+56 9 1234 5678",
        code: "LOCAL-XP125",
        status: "active"
      };
    }
    
    res.json({
      ...user,
      partnerProfile
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Registrar un nuevo socio Vecinos
router.post('/register', async (req, res) => {
  const { username, password, fullName, email, businessName, storeAddress, storePhone } = req.body;
  
  try {
    // Verificar si el usuario ya existe
    const [existingUser] = await db.select({
      id: users.id
    }).from(users).where(
      eq(users.username, username)
    ).limit(1);
    
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }
    
    // Crear el usuario
    const [newUser] = await db.insert(users).values({
      username,
      password, // En producción, se debería hashear
      fullName,
      email,
      role: 'partner',
      platform: 'vecinos',
      createdAt: new Date()
    }).returning();
    
    // Crear el perfil de socio
    const partnerCode = 'LOCAL-XP' + Math.floor(1000 + Math.random() * 9000);
    const [newPartner] = await db.insert(partners).values({
      userId: newUser.id,
      name: businessName,
      address: storeAddress,
      phone: storePhone,
      code: partnerCode,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Crear token JWT
    const token = jwt.sign(
      { 
        id: newUser.id, 
        username: newUser.username, 
        role: newUser.role,
        partnerId: newPartner.id 
      },
      process.env.JWT_SECRET || 'vecinos-secret',
      { expiresIn: '24h' }
    );
    
    // Enviar respuesta
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        fullName: newUser.fullName,
        email: newUser.email,
        partnerProfile: newPartner
      }
    });
  } catch (error) {
    console.error('Error al registrar socio:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Utiliza el router de pagos
router.use('/payments', paymentsRouter);

export default router;