import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import { simpleStorage, type SimpleUser } from "./simple-storage";
import { hashPassword, verifyPassword, generateRandomPassword } from "./simple-auth";

const app = express();

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      console.log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Inicializar primer administrador
async function initializeAdmin() {
  const existingAdmin = simpleStorage.findUserByUsername("admin");
  
  if (existingAdmin) {
    console.log("✅ Administrador ya existe");
    return;
  }

  const adminPassword = generateRandomPassword(12);
  const hashedPassword = await hashPassword(adminPassword);
  
  const admin: SimpleUser = {
    id: Date.now(),
    username: "admin",
    password: hashedPassword,
    email: "admin@docusignpro.com",
    fullName: "Administrador Principal",
    role: "admin",
    platform: "notarypro",
    createdAt: new Date()
  };
  
  simpleStorage.addUser(admin);
  
  console.log("🎉 ADMINISTRADOR CREADO:");
  console.log(`   Usuario: admin`);
  console.log(`   Contraseña: ${adminPassword}`);
  console.log("⚠️  Guarda estas credenciales");
}

// Rutas API
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "DocuSignPro Development Server",
    timestamp: new Date().toISOString(),
    users: simpleStorage.getAllUsers().length,
    version: "1.0.0-dev"
  });
});

app.get("/api/users", (req, res) => {
  const users = simpleStorage.getAllUsers().map(user => ({
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    platform: user.platform,
    createdAt: user.createdAt
  }));
  res.json(users);
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Usuario y contraseña requeridos" });
    }

    const user = simpleStorage.findUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    res.json({
      message: "Login exitoso",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        platform: user.platform
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, email, fullName } = req.body;
    
    if (!username || !password || !email || !fullName) {
      return res.status(400).json({ message: "Todos los campos son requeridos" });
    }

    // Verificar si el usuario ya existe
    if (simpleStorage.findUserByUsername(username)) {
      return res.status(409).json({ message: "El usuario ya existe" });
    }
    
    if (simpleStorage.findUserByEmail(email)) {
      return res.status(409).json({ message: "El email ya está registrado" });
    }

    const hashedPassword = await hashPassword(password);
    
    const newUser: SimpleUser = {
      id: Date.now(),
      username,
      password: hashedPassword,
      email,
      fullName,
      role: "user",
      platform: "notarypro",
      createdAt: new Date()
    };
    
    simpleStorage.addUser(newUser);
    
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// API para gestión básica de documentos
app.get("/api/documents", (req, res) => {
  // Simular algunos documentos de ejemplo
  const documents = [
    {
      id: 1,
      title: "Contrato de Arrendamiento",
      status: "draft",
      createdAt: new Date().toISOString(),
      type: "contract"
    },
    {
      id: 2,
      title: "Poder Notarial",
      status: "pending_signature",
      createdAt: new Date().toISOString(),
      type: "power_of_attorney"
    }
  ];
  
  res.json(documents);
});

app.post("/api/documents", (req, res) => {
  const { title, type } = req.body;
  
  if (!title || !type) {
    return res.status(400).json({ message: "Título y tipo son requeridos" });
  }
  
  const newDocument = {
    id: Date.now(),
    title,
    type,
    status: "draft",
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json({
    message: "Documento creado exitosamente",
    document: newDocument
  });
});

// API para estadísticas básicas
app.get("/api/stats", (req, res) => {
  const users = simpleStorage.getAllUsers();
  const admins = users.filter(u => u.role === "admin");
  const regularUsers = users.filter(u => u.role === "user");
  
  res.json({
    totalUsers: users.length,
    admins: admins.length,
    regularUsers: regularUsers.length,
    platforms: {
      notarypro: users.filter(u => u.platform === "notarypro").length,
      vecinos: users.filter(u => u.platform === "vecinos").length
    },
    lastRegistration: users.length > 0 ? users[users.length - 1].createdAt : null
  });
});

// Ruta para página de pruebas
app.get("/test", (req, res) => {
  const testPath = path.join(process.cwd(), "test-frontend.html");
  res.sendFile(testPath);
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(process.cwd(), "dist/public")));

// Catch-all para SPA
app.get("*", (req, res) => {
  const indexPath = path.join(process.cwd(), "dist/public/index.html");
  res.sendFile(indexPath);
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Error:", err);
  res.status(status).json({ message });
});

async function startServer() {
  try {
    console.log("🚀 Iniciando DocuSignPro Development Server...");
    
    // Inicializar administrador
    await initializeAdmin();
    
    const server = createServer(app);
    const port = 5000;
    
    server.listen(port, "0.0.0.0", () => {
      console.log("");
      console.log("🎉 ¡SERVIDOR FUNCIONANDO!");
      console.log(`📡 URL: http://localhost:${port}`);
      console.log(`👤 Usuarios: ${simpleStorage.getAllUsers().length}`);
      console.log("");
             console.log("📋 API Endpoints:");
       console.log("   GET  /api/health - Estado del servidor");
       console.log("   GET  /api/users - Lista de usuarios");
       console.log("   GET  /api/stats - Estadísticas");
       console.log("   GET  /api/documents - Lista de documentos");
       console.log("   POST /api/login - Autenticación");
       console.log("   POST /api/register - Registro de usuarios");
       console.log("   POST /api/documents - Crear documento");
       console.log("");
       console.log("🌐 Frontend: http://localhost:5000");
       console.log("🧪 Página de pruebas: http://localhost:5000/test");
       console.log("✅ ¡Todo listo para desarrollo!");
    });
    
  } catch (error) {
    console.error("❌ Error iniciando servidor:", error);
    process.exit(1);
  }
}

startServer();