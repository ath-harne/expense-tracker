import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/runtime.js";

export const SESSION_COOKIE = "bucks2bars_session";

export function requireAuth(request, response, next) {
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token || !jwtSecret) {
        return response.status(401).json({ error: "Please sign in to continue." });
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
            return response.status(401).json({ error: "Your session is invalid. Please sign in again." });
        }
        request.authUser = { id: payload.sub, email: payload.email };
        return next();
    } catch {
        return response.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
}