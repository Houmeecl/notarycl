import express from "express";
import type { Request, Response, NextFunction } from "express";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { initializeFirstAdmin } from "./init-admin";
import { createServer } from "http";
import path from "path";

const app = express();

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Configurar autenticación
setupAuth(app);

// Rutas básicas de desarrollo
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "DocuSignPro Development Server",
    timestamp: new Date().toISOString(),
    users: storage.users.length
  });
});

app.get("/api/users", (req, res) => {
  const usersInfo = storage.users.map(user => ({
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    platform: user.platform
  }));
  res.json(usersInfo);
});

// Ruta de login básica
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: "Usuario y contraseña requeridos" });
  }

  // Buscar usuario
  const user = storage.users.find(u => u.username === username);
  
  if (!user) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  // En desarrollo, aceptar cualquier contraseña para testing
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
});

// Servir archivos estáticos
app.use(express.static(path.join(process.cwd(), "dist/public")));

// Catch-all para SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "dist/public/index.html"));
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Error:", err);
  res.status(status).json({ message });
});

async function startDevServer() {
  try {
    // Inicializar primer administrador
    await initializeFirstAdmin();
    
    const server = createServer(app);
    const port = 5000;
    
    server.listen(port, "0.0.0.0", () => {
      console.log("🚀 DocuSignPro Development Server");
      console.log(`📡 Servidor ejecutándose en http://localhost:${port}`);
      console.log(`👤 Usuarios registrados: ${storage.users.length}`);
      console.log("📋 Endpoints disponibles:");
      console.log("   GET  /api/health - Estado del servidor");
      console.log("   GET  /api/users - Lista de usuarios");
      console.log("   POST /api/login - Autenticación");
      console.log("");
      console.log("✅ ¡Servidor listo para desarrollo!");
    });
    
  } catch (error) {
    console.error("❌ Error iniciando servidor:", error);
    process.exit(1);
  }
}

startDevServer();