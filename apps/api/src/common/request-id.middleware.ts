import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

/** ให้ทุก request มี requestId เดียวกันตลอด lifecycle — ใช้ผูก audit log กับ request ที่ทำให้เกิด (T1.5) */
export function requestIdMiddleware(
  req: Request & { requestId?: string },
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  req.requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.requestId);
  next();
}
