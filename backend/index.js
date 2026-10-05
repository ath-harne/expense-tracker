import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import User from "./models/User.js";
import { isProduction } from "./config/runtime.js";

const app = express();
const port = Number(process.env.PORT) || 3001;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bucks2bars";
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDirectory, "../frontend/dist");

const ExpenseSchema = new mongoose.Schema({
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, required: true, trim: true, maxlength: 120 }
}, { timestamps: true });

const YearSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    incomes: {
        type: [{ type: Number, min: 0 }],
        default: () => Array(12).fill(0),
        validate: (values) => values.length === 12
    },
    expenses: { type: [ExpenseSchema], default: [] }
}, { timestamps: true });
YearSchema.index({ userId: 1, year: 1 }, { unique: true });

const FinanceYear = mongoose.model("FinanceYear", YearSchema);

app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use("/api/auth", authRoutes);

function parseYear(value) {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        const error = new Error("Year must be between 2000 and 2100.");
        error.status = 400;
        throw error;
    }
    return year;
}

function serializeYear(record, year) {
    return {
        year,
        incomes: Array.from({ length: 12 }, (_, index) => Number(record?.incomes?.[index]) || 0),
        expenses: (record?.expenses || []).map((expense) => ({
            id: expense._id.toString(),
            date: expense.date,
            amount: expense.amount,
            category: expense.category,
            description: expense.description
        }))
    };
}

async function ensureYear(userId, year) {
    try {
        return await FinanceYear.findOneAndUpdate(
            { userId, year },
            { $setOnInsert: { userId, year, incomes: Array(12).fill(0), expenses: [] } },
            { new: true, upsert: true, setDefaultsOnInsert: false, runValidators: true }
        );
    } catch (error) {
        if (error.code !== 11000) throw error;
        return FinanceYear.findOne({ year });
    }
}

function isValidCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

app.get("/api/health", (request, response) => {
    response.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.get("/api/years/:year", requireAuth, async (request, response) => {
    const year = parseYear(request.params.year);
    const record = await FinanceYear.findOne({ userId: request.authUser.id, year });
    response.json(serializeYear(record, year));
});

app.put("/api/years/:year/incomes/:month", requireAuth, async (request, response) => {
    const year = parseYear(request.params.year);
    const month = Number(request.params.month);
    const amount = Number(request.body?.amount);
    if (!Number.isInteger(month) || month < 0 || month > 11) {
        return response.status(400).json({ error: "Month must be between 0 and 11." });
    }
    if (!Number.isFinite(amount) || amount < 0) {
        return response.status(400).json({ error: "Income must be a number greater than or equal to zero." });
    }

    await ensureYear(request.authUser.id, year);
    const record = await FinanceYear.findOneAndUpdate(
        { userId: request.authUser.id, year },
        { $set: { [`incomes.${month}`]: amount } },
        { new: true, runValidators: true }
    );
    response.json(serializeYear(record, year));
});

app.post("/api/years/:year/expenses", requireAuth, async (request, response) => {
    const year = parseYear(request.params.year);
    const { date, category, description } = request.body || {};
    const amount = Number(request.body?.amount);
    if (!isValidCalendarDate(date) || date !== new Date().toISOString().slice(0, 10)) {
        return response.status(400).json({ error: "Expenses can only be added for today." });
    }
    if (Number(date.slice(0, 4)) !== year) {
        return response.status(400).json({ error: `Enter a valid date in ${year}.` });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        return response.status(400).json({ error: "Expense amount must be greater than zero." });
    }
    if (typeof category !== "string" || !category.trim() || category.trim().length > 40) {
        return response.status(400).json({ error: "Category is required and must be 40 characters or fewer." });
    }
    if (typeof description !== "string" || !description.trim() || description.trim().length > 120) {
        return response.status(400).json({ error: "Description is required and must be 120 characters or fewer." });
    }

    await ensureYear(request.authUser.id, year);
    const record = await FinanceYear.findOneAndUpdate(
        { userId: request.authUser.id, year },
        { $push: { expenses: { date, amount, category: category.trim(), description: description.trim() } } },
        { new: true, runValidators: true }
    );
    response.status(201).json(serializeYear(record, year));
});

app.delete("/api/years/:year/expenses/:expenseId", requireAuth, async (request, response) => {
    const year = parseYear(request.params.year);
    if (!mongoose.isValidObjectId(request.params.expenseId)) {
        return response.status(400).json({ error: "Invalid expense ID." });
    }

    const record = await FinanceYear.findOneAndUpdate(
        { userId: request.authUser.id, year, "expenses._id": request.params.expenseId },
        { $pull: { expenses: { _id: request.params.expenseId } } },
        { new: true }
    );
    if (!record) return response.status(404).json({ error: "Expense not found." });
    response.json(serializeYear(record, year));
});

app.use("/api", (request, response) => response.status(404).json({ error: "API route not found." }));
app.use(express.static(clientDist));
app.use((request, response) => response.status(404).send("Not found"));

app.use((error, request, response, next) => {
    console.error(error);
    const status = error.status || (error.name === "ValidationError" || error.name === "CastError" ? 400 : 500);
    response.status(status).json({ error: status === 500 ? "Unexpected server error." : error.message });
});

try {
    if (isProduction && !process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be configured in production.");
    }
    await mongoose.connect(mongoUri);
    await User.createIndexes();
    const indexes = await FinanceYear.collection.indexes().catch((error) => {
        if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
        throw error;
    });
    const oldYearIndex = indexes.find((index) => index.unique && index.key?.year === 1 && Object.keys(index.key).length === 1);
    if (oldYearIndex) await FinanceYear.collection.dropIndex(oldYearIndex.name);
    await FinanceYear.createIndexes();
    app.listen(port, "0.0.0.0", () => {
        console.log(`bucks2bars API listening on http://127.0.0.1:${port}`);
        console.log(`MongoDB connected to database: ${mongoose.connection.name}`);
    });
} catch (error) {
    console.error("Could not connect to MongoDB. Check MONGO_URI and verify the database is reachable.", error.message);
    process.exitCode = 1;
}