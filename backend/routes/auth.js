import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { requireAuth, SESSION_COOKIE } from "../middleware/requireAuth.js";
import { isProduction, jwtSecret } from "../config/runtime.js";

const router = Router();
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please try again in 15 minutes." }
});

function setSessionCookie(response, user) {
    const token = jwt.sign(
        { email: user.email },
        jwtSecret,
        { subject: user._id.toString(), expiresIn: "7d" }
    );
    response.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: sessionDurationMs
    });
}

function safeUser(user) {
    return { id: user._id.toString(), email: user.email };
}

function normalizedEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
    return typeof password === "string" && password.length >= 8 && Buffer.byteLength(password, "utf8") <= 72;
}

router.post("/register", authLimiter, async (request, response) => {
    const email = normalizedEmail(request.body?.email);
    const password = request.body?.password;
    if (!validEmail(email)) {
        return response.status(400).json({ error: "Enter a valid email address." });
    }
    if (!validPassword(password)) {
        return response.status(400).json({ error: "Password must be at least 8 characters and no more than 72 bytes." });
    }

    try {
        const user = await User.create({
            email,
            passwordHash: await bcrypt.hash(password, 12)
        });
        setSessionCookie(response, user);
        return response.status(201).json({ user: safeUser(user) });
    } catch (error) {
        if (error.code === 11000) {
            return response.status(409).json({ error: "An account with this email already exists." });
        }
        throw error;
    }
});

router.post("/login", authLimiter, async (request, response) => {
    const email = normalizedEmail(request.body?.email);
    const password = request.body?.password;
    if (!validEmail(email) || typeof password !== "string") {
        return response.status(401).json({ error: "Invalid email or password." });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return response.status(401).json({ error: "Invalid email or password." });
    }

    setSessionCookie(response, user);
    return response.json({ user: safeUser(user) });
});

router.get("/me", requireAuth, (request, response) => {
    response.json({ user: request.authUser });
});

router.post("/logout", (request, response) => {
    response.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/"
    });
    response.status(204).end();
});

export default router;