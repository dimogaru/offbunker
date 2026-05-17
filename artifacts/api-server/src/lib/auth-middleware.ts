import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "No autenticado. Inicia sesión." });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId || req.session.role !== "superadmin") {
    res.status(403).json({ error: "Acceso denegado. Se requieren permisos de administrador." });
    return;
  }
  next();
}
