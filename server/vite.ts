import express from "express";
import path from "path";

export function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export async function setupVite(app: express.Application, server: any) {
  // In development, this would setup Vite dev server
  // For now, just serve static files
  log("Setting up development server...");
  serveStatic(app);
}

export function serveStatic(app: express.Application) {
  // Serve static files from dist/public if it exists
  try {
    const publicDir = path.resolve(process.cwd(), "dist/public");
    app.use(express.static(publicDir));
    log("Serving static files from dist/public");
  } catch (error) {
    log("No static files directory found, serving API only");
  }
  
  // Catch-all handler for SPA routing
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "API route not found" });
    }
    
    // For non-API routes, send a simple response
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NotaryPro API Server</title>
        </head>
        <body>
          <h1>NotaryPro API Server</h1>
          <p>The API server is running. Access the API endpoints at /api/*</p>
        </body>
      </html>
    `);
  });
}