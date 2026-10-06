import { useEffect, useRef, useState } from "react";
import {
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip
} from "chart.js";
import AuthScreen from "./AuthScreen.jsx";
import { addExpense, getCurrentUser, getYear, loginAccount, logoutAccount, removeExpense, saveIncome } from "./api.js";

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});
const compactCurrency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1
});

function emptyYear(year) {
    return { year, incomes: Array(12).fill(0), expenses: [] };
}

function money(amount) {
    return currency.format(amount || 0);
}

function compactMoney(amount) {
    return compactCurrency.format(amount || 0);
}

function todayDate() {
    return new Date().toISOString().slice(0, 10);
}

function normalizeYear(data, year) {
    return {
        year,
        incomes: Array.from({ length: 12 }, (_, month) => Number(data?.incomes?.[month]) || 0),
        expenses: Array.isArray(data?.expenses) ? data.expenses : []
    };
}

function SummaryCard({ label, value, note, color = "" }) {
    return (
        <article className="rounded-xl border border-[#e3e9e3] bg-white p-5">
            <p className="text-sm font-medium text-[#718078]">{label}</p>
            <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${color}`}>{money(value)}</p>
            <p className="mt-1 text-xs text-[#87928b]">{note}</p>
        </article>
    );
}

function IncomeExpenseChart({ incomes, expenses, active }) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        if (!active || !canvasRef.current) return undefined;

        chartRef.current = new ChartJS(canvasRef.current, {
            type: "bar",
            data: {
                labels: MONTHS.map((month) => month.slice(0, 3)),
                datasets: [
                    { label: "Income", data: incomes, backgroundColor: "#39805d", borderRadius: 5, maxBarThickness: 24 },
                    { label: "Expenses", data: expenses, backgroundColor: "#e88d61", borderRadius: 5, maxBarThickness: 24 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: {
                        position: "top",
                        align: "end",
                        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, color: "#58665e", padding: 20 }
                    },
                    tooltip: {
                        callbacks: { label: (context) => `${context.dataset.label}: ${money(context.parsed.y)}` }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: "#718078" }, border: { display: false } },
                    y: {
                        beginAtZero: true,
                        grid: { color: "#edf0ed" },
                        ticks: { color: "#718078", callback: (value) => compactMoney(value) },
                        border: { display: false }
                    }
                }
            }
        });

        return () => {
            chartRef.current?.destroy();
            chartRef.current = null;
        };
    }, [active]);

    useEffect(() => {
        if (!chartRef.current) return;
        chartRef.current.data.datasets[0].data = incomes;
        chartRef.current.data.datasets[1].data = expenses;
        chartRef.current.update();
    }, [incomes, expenses]);

    return <canvas ref={canvasRef} aria-label="Monthly income and expenses bar chart" role="img" />;
}

export default function App() {
    const initialDate = todayDate();
    const initialYear = Number(initialDate.slice(0, 4));
    const initialMonth = Number(initialDate.slice(5, 7)) - 1;
    const today = todayDate();
    const [authUser, setAuthUser] = useState(null);
    const [authChecking, setAuthChecking] = useState(true);
    const [authError, setAuthError] = useState("");
    const [year, setYear] = useState(initialYear);
    const [yearDraft, setYearDraft] = useState(String(initialYear));
    const [yearData, setYearData] = useState(() => emptyYear(initialYear));
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [incomeDraft, setIncomeDraft] = useState("");
    const [activeTab, setActiveTab] = useState("data");
    const [expenseDraft, setExpenseDraft] = useState(() => ({
        amount: "",
        category: "",
        description: ""
    }));
    const [formError, setFormError] = useState("");
    const [apiError, setApiError] = useState("");
    const [saveStatus, setSaveStatus] = useState("Connecting to MongoDB");
    const [isLoading, setIsLoading] = useState(true);
    const selectedYearRef = useRef(initialYear);
    const dataTabRef = useRef(null);
    const chartTabRef = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        getCurrentUser(controller.signal)
            .then((user) => {
                if (!controller.signal.aborted) setAuthUser(user);
            })
            .catch((error) => {
                if (!controller.signal.aborted) setAuthError(error.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setAuthChecking(false);
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!authUser) {
            setIsLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        setIsLoading(true);
        setSaveStatus("Loading from MongoDB");
        setApiError("");

        getYear(year, controller.signal)
            .then((data) => {
                if (controller.signal.aborted) return;
                const normalized = normalizeYear(data, year);
                setYearData(normalized);
                setIncomeDraft(String(normalized.incomes[selectedMonth] || ""));
               
            })
            .catch((error) => {
                if (error.name === "AbortError") return;
                setApiError(`Could not load this year's data: ${error.message}`);
                setSaveStatus("Database unavailable");
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [year, authUser?.id]);

    const monthExpenses = MONTHS.map((_, month) => {
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        return yearData.expenses
            .filter((expense) => expense.date.startsWith(key))
            .reduce((total, expense) => total + expense.amount, 0);
    });
    const totalIncome = yearData.incomes.reduce((total, amount) => total + amount, 0);
    const totalExpenses = yearData.expenses.reduce((total, expense) => total + expense.amount, 0);
    const balance = totalIncome - totalExpenses;
    const selectedMonthIncome = yearData.incomes[selectedMonth] || 0;
    const selectedMonthExpenses = monthExpenses[selectedMonth];
    const selectedMonthBalance = selectedMonthIncome - selectedMonthExpenses;
    const monthName = MONTHS[selectedMonth];
    const visibleExpenses = yearData.expenses
        .filter((expense) => expense.date.startsWith(`${year}-${String(selectedMonth + 1).padStart(2, "0")}`))
        .sort((first, second) => second.date.localeCompare(first.date) || second.id.localeCompare(first.id));

    function changeYear(event) {
        setYearDraft(event.target.value);
    }

    function commitYear() {
        const nextYear = Number(yearDraft);
        if (!Number.isInteger(nextYear) || nextYear < 2000 || nextYear > 2100) {
            setYearDraft(String(year));
            return;
        }
        if (nextYear === year) return;

        selectedYearRef.current = nextYear;
        setYear(nextYear);
        setYearData(emptyYear(nextYear));
    }

    function chooseMonth(month) {
        setSelectedMonth(month);
        setIncomeDraft(String(yearData.incomes[month] || ""));
    }

    function updateIncome(month, value) {
        const amount = value === "" ? 0 : Number(value);
        if (!Number.isFinite(amount) || amount < 0) return;
        setYearData((current) => ({
            ...current,
            incomes: current.incomes.map((income, index) => index === month ? amount : income)
        }));
        if (month === selectedMonth) setIncomeDraft(value);
    }

    async function submitMonthlyIncome(event) {
        event.preventDefault();
        const amount = incomeDraft.trim() === "" ? 0 : Number(incomeDraft);
        if (!Number.isFinite(amount) || amount < 0) {
            setApiError("Enter a valid monthly income amount.");
            return;
        }

        const requestYear = year;
        const requestMonth = selectedMonth;
        setSaveStatus("Saving to MongoDB");
        setApiError("");
        try {
            const updated = await saveIncome(requestYear, requestMonth, amount);
            if (selectedYearRef.current !== requestYear) return;
            setYearData(normalizeYear(updated, requestYear));
            setIncomeDraft(String(amount || ""));
            setSaveStatus("Saved to MongoDB");
        } catch (error) {
            if (selectedYearRef.current !== requestYear) return;
            setSaveStatus("Save failed");
            setApiError(`Could not save monthly income: ${error.message}`);
        }
    }

    async function persistIncome(month) {
        const amount = yearData.incomes[month];
        const requestYear = year;
        setSaveStatus("Saving to MongoDB");
        setApiError("");
        try {
            await saveIncome(requestYear, month, amount);
            if (selectedYearRef.current === requestYear) setSaveStatus("Saved to MongoDB");
        } catch (error) {
            if (selectedYearRef.current !== requestYear) return;
            setSaveStatus("Save failed");
            setApiError(`Could not save income: ${error.message}`);
        }
    }

    function updateExpenseField(event) {
        const { name, value } = event.target;
        setExpenseDraft((current) => ({ ...current, [name]: value }));
        setFormError("");
    }

    async function submitExpense(event) {
        event.preventDefault();
        setFormError("");
        const amount = Number(expenseDraft.amount);
        const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
        const parsedDate = dateParts
            ? new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])))
            : null;
        if (!dateParts || !parsedDate || parsedDate.toISOString().slice(0, 10) !== today) {
            setFormError("Enter a valid expense date.");
            return;
        }
        if (Number(dateParts[1]) !== year) {
            setFormError("Select the current year to add today's expense.");
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setFormError("Enter an amount greater than zero.");
            return;
        }
        if (!expenseDraft.category.trim() || !expenseDraft.description.trim()) {
            setFormError("Add both a category and a description.");
            return;
        }

        setSaveStatus("Saving to MongoDB");
        setApiError("");
        try {
            const updated = await addExpense(year, {
                date: today,
                amount,
                category: expenseDraft.category.trim(),
                description: expenseDraft.description.trim()
            });
            if (selectedYearRef.current !== year) return;
            setYearData(normalizeYear(updated, year));
            setSelectedMonth(Number(dateParts[2]) - 1);
            setExpenseDraft((current) => ({ ...current, amount: "", category: "", description: "" }));
            setSaveStatus("Saved to MongoDB");
        } catch (error) {
            if (selectedYearRef.current !== year) return;
            setSaveStatus("Save failed");
            setApiError(`Could not save expense: ${error.message}`);
        }
    }

    async function deleteExpense(expenseId) {
        const requestYear = year;
        setSaveStatus("Saving to MongoDB");
        setApiError("");
        try {
            const updated = await removeExpense(requestYear, expenseId);
            if (selectedYearRef.current !== requestYear) return;
            setYearData(normalizeYear(updated, requestYear));
            setSaveStatus("Saved to MongoDB");
        } catch (error) {
            if (selectedYearRef.current !== requestYear) return;
            setSaveStatus("Save failed");
            setApiError(`Could not remove expense: ${error.message}`);
        }
    }

    async function signOut() {
        try {
            await logoutAccount();
            setAuthUser(null);
            setYearData(emptyYear(year));
            setApiError("");
            setAuthError("");
            setSaveStatus("Signed out");
        } catch (error) {
            setApiError(`Could not log out: ${error.message}`);
        }
    }

    function handleTabKeyDown(event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const nextTab = activeTab === "data" ? "chart" : "data";
        setActiveTab(nextTab);
        (nextTab === "data" ? dataTabRef : chartTabRef).current?.focus();
    }

    if (authChecking) {
        return <div className="flex min-h-screen items-center justify-center bg-[#f3f5f2] font-sans text-sm text-[#718078]">Checking your account...</div>;
    }

    if (!authUser) {
        return <AuthScreen onAuthenticated={(user) => {
            setAuthUser(user);
            setAuthError("");
        }} initialError={authError} />;
    }

    return (
        <div className="min-h-screen bg-[#f3f5f2] font-sans text-[#202923] antialiased">
            <header className="border-b border-[#e2e8e2] bg-white">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <a className="flex items-center gap-3" href="#" aria-label="bucks2bars home">
                        <span className="flex h-10 w-10 items-end justify-center gap-1 rounded-xl bg-[#1f5b45] px-2 pb-2" aria-hidden="true">
                            <span className="h-3 w-1.5 rounded-sm bg-[#a6d5b1]" />
                            <span className="h-5 w-1.5 rounded-sm bg-white" />
                            <span className="h-7 w-1.5 rounded-sm bg-[#f1a76f]" />
                        </span>
                        <span>
                            <span className="block font-display text-lg font-extrabold leading-tight tracking-normal">bucks2bars</span>
                            <span className="block text-xs text-[#718078]">Your year, in balance</span>
                        </span>
                    </a>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="hidden text-xs text-[#718078] sm:inline">{authUser.email}</span>
                        <label className="flex items-center gap-3 text-sm font-semibold text-[#58665e]" htmlFor="year-select">
                            Year
                            <input
                                id="year-select"
                                type="number"
                                min="2000"
                                max="2100"
                                step="1"
                                value={yearDraft}
                                onChange={changeYear}
                                onBlur={commitYear}
                                onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                                className="h-10 w-24 rounded-lg border border-[#dce4dc] bg-white px-3 text-center font-semibold text-[#202923] outline-none transition focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15"
                                aria-label="Selected year"
                            />
                        </label>
                        <button type="button" onClick={signOut} className="h-10 rounded-lg border border-[#dce4dc] px-3 text-sm font-semibold text-[#58665e] transition hover:bg-[#f7f9f6] focus:outline-none focus:ring-2 focus:ring-[#337b5b]/30">Log out</button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 pb-12 pt-7 sm:px-6 lg:px-8">
                <section aria-label="Monthly totals" className="mb-7 grid gap-3 sm:grid-cols-3">
                    <SummaryCard label="Income this month" value={selectedMonthIncome} note={`For ${monthName} ${year}`} />
                    <SummaryCard label="Expenses this month" value={selectedMonthExpenses} note={`For ${monthName} ${year}`} color="text-[#b95d40]" />
                    <SummaryCard label="Remaining this month" value={selectedMonthBalance} note="Income minus expenses" color={selectedMonthBalance < 0 ? "text-[#b95d40]" : "text-[#1f704d]"} />
                </section>

                <div className="mb-5 flex items-center justify-between border-b border-[#dce4dc]">
                    <div className="flex gap-1" role="tablist" aria-label="Tracker views">
                        <button
                            ref={dataTabRef}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "data"}
                            aria-controls="data-panel"
                            tabIndex={activeTab === "data" ? 0 : -1}
                            onClick={() => setActiveTab("data")}
                            onKeyDown={handleTabKeyDown}
                            className={`border-b-2 px-4 py-3 text-sm transition ${activeTab === "data" ? "border-[#1f704d] font-bold text-[#1f704d]" : "border-transparent font-semibold text-[#718078] hover:text-[#202923]"}`}
                        >Data</button>
                        <button
                            ref={chartTabRef}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "chart"}
                            aria-controls="chart-panel"
                            tabIndex={activeTab === "chart" ? 0 : -1}
                            onClick={() => setActiveTab("chart")}
                            onKeyDown={handleTabKeyDown}
                            className={`border-b-2 px-4 py-3 text-sm transition ${activeTab === "chart" ? "border-[#1f704d] font-bold text-[#1f704d]" : "border-transparent font-semibold text-[#718078] hover:text-[#202923]"}`}
                        >Chart</button>
                    </div>
                    <p className="pb-1 text-xs text-[#718078]" role="status" aria-live="polite">{isLoading ? "Loading from MongoDB" : saveStatus}</p>
                </div>

                {apiError && <p className="mb-4 rounded-lg border border-[#f0c9ba] bg-[#fff5f0] px-4 py-3 text-sm text-[#9f432e]" role="alert">{apiError}</p>}

                <section id="data-panel" role="tabpanel" aria-labelledby="data-tab" hidden={activeTab !== "data"}>
                    <div className="overflow-hidden rounded-xl border border-[#e3e9e3] bg-white">
                        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8980]">Year at a glance</p>
                                <h1 className="mt-1 font-display text-xl font-bold">Monthly income and expenses</h1>
                            </div>
                            <p className="text-xs text-[#87928b]">Select a month to review its daily expenses</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-collapse text-left text-[11px] sm:text-sm md:min-w-162.5 md:table-auto">
                                <thead className="bg-[#f7f9f6] text-xs font-semibold uppercase tracking-wide text-[#718078]">
                                    <tr>
                                        <th scope="col" className="w-[23%] px-1.5 py-3 sm:px-6">Month</th>
                                        <th scope="col" className="w-[27%] px-1.5 py-3 sm:px-5">Income</th>
                                        <th scope="col" className="w-[25%] px-1.5 py-3 sm:px-5">Expenses</th>
                                        <th scope="col" className="w-[25%] px-1.5 py-3 sm:pr-6">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#edf0ed]">
                                    {MONTHS.map((month, index) => {
                                        const expenses = monthExpenses[index];
                                        const monthBalance = yearData.incomes[index] - expenses;
                                        return (
                                            <tr key={month} className={`${selectedMonth === index ? "bg-[#f5f9f5]" : "bg-white"} transition hover:bg-[#f7f9f6]`}>
                                                <th scope="row" className="whitespace-nowrap px-5 py-2.5 font-semibold sm:px-6">
                                                    <button type="button" onClick={() => chooseMonth(index)} aria-pressed={selectedMonth === index} className="rounded px-1 py-1 text-left hover:text-[#1f704d] focus:outline-none focus:ring-2 focus:ring-[#337b5b]/30">{month}</button>
                                                </th>
                                                <td className="px-1.5 py-2.5 sm:px-5">
                                                    <label className="flex h-9 w-full min-w-0 items-center gap-1 rounded-md border border-transparent px-1 transition focus-within:border-[#c5d8c9] focus-within:bg-white sm:w-36 sm:gap-1.5 sm:px-2">
                                                        <span className="text-[#87928b]">₹</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            inputMode="decimal"
                                                            value={yearData.incomes[index] || ""}
                                                            placeholder="0"
                                                            aria-label={`${month} income`}
                                                            onChange={(event) => updateIncome(index, event.target.value)}
                                                            onBlur={() => persistIncome(index)}
                                                            className="min-w-0 w-full bg-transparent text-right text-[11px] tabular-nums outline-none placeholder:text-[#bdc5be] sm:text-sm"
                                                        />
                                                    </label>
                                                </td>
                                                <td className="whitespace-nowrap px-1.5 py-2.5 tabular-nums text-[#b95d40] sm:px-5" title={money(expenses)}>
                                                    <span className="md:hidden">{compactMoney(expenses)}</span><span className="hidden md:inline">{money(expenses)}</span>
                                                </td>
                                                <td className={`whitespace-nowrap px-1.5 py-2.5 tabular-nums sm:px-5 sm:pr-6 ${monthBalance < 0 ? "text-[#b95d40]" : "text-[#1f704d]"}`} title={money(monthBalance)}>
                                                    <span className="md:hidden">{compactMoney(monthBalance)}</span><span className="hidden md:inline">{money(monthBalance)}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="border-t border-[#dce4dc] bg-[#f7f9f6]">
                                    <tr className="text-sm font-bold">
                                        <th scope="row" className="px-1.5 py-3.5 sm:px-6">Total</th>
                                        <td className="whitespace-nowrap px-1.5 py-3.5 tabular-nums sm:px-5" title={money(totalIncome)}><span className="md:hidden">{compactMoney(totalIncome)}</span><span className="hidden md:inline">{money(totalIncome)}</span></td>
                                        <td className="whitespace-nowrap px-1.5 py-3.5 tabular-nums text-[#b95d40] sm:px-5" title={money(totalExpenses)}><span className="md:hidden">{compactMoney(totalExpenses)}</span><span className="hidden md:inline">{money(totalExpenses)}</span></td>
                                        <td className={`whitespace-nowrap px-1.5 py-3.5 tabular-nums sm:px-5 sm:pr-6 ${balance < 0 ? "text-[#b95d40]" : "text-[#1f704d]"}`} title={money(balance)}><span className="md:hidden">{compactMoney(balance)}</span><span className="hidden md:inline">{money(balance)}</span></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <section className="mt-6 rounded-xl border border-[#e3e9e3] bg-white p-5 sm:p-6" aria-labelledby="income-heading">
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8980]">Monthly income</p>
                                <h2 id="income-heading" className="mt-1 font-display text-xl font-bold">Set income for {monthName}</h2>
                            </div>
                            <p className="text-sm text-[#718078]">{year}</p>
                        </div>
                        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={submitMonthlyIncome}>
                            <label className="block text-sm font-semibold text-[#46534b]">
                                Income amount (₹)
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="25000"
                                    value={incomeDraft}
                                    onChange={(event) => {
                                        setIncomeDraft(event.target.value);
                                        setApiError("");
                                    }}
                                    className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition placeholder:text-[#a2aaa4] focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15"
                                    aria-label={`${monthName} monthly income`}
                                />
                            </label>
                            <button type="submit" disabled={isLoading} className="h-11 rounded-lg bg-[#1f5b45] px-5 text-sm font-bold text-white transition hover:bg-[#174936] focus:outline-none focus:ring-2 focus:ring-[#337b5b] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">Save income</button>
                        </form>
                    </section>

                    <section className="mt-6 rounded-xl border border-[#e3e9e3] bg-white p-5 sm:p-6" aria-labelledby="expense-heading">
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8980]">Daily log</p>
                                <h2 id="expense-heading" className="mt-1 font-display text-xl font-bold">Add an expense</h2>
                            </div>
                            <p className="text-sm text-[#718078]">For <span className="font-semibold text-[#202923]">{monthName} {year}</span></p>
                        </div>
                        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={submitExpense} noValidate>
                            <label className="block text-sm font-semibold text-[#46534b]">
                                Date
                                <input name="date" type="date" min={today} max={today} required readOnly value={today} className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15" />
                            </label>
                            <label className="block text-sm font-semibold text-[#46534b]">
                                Amount (₹)
                                <input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" required value={expenseDraft.amount} onChange={updateExpenseField} className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15" />
                            </label>
                            <label className="block text-sm font-semibold text-[#46534b]">
                                Category
                                <input name="category" type="text" maxLength="40" placeholder="Food, travel..." required value={expenseDraft.category} onChange={updateExpenseField} className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition placeholder:text-[#a2aaa4] focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15" />
                            </label>
                            <label className="block text-sm font-semibold text-[#46534b]">
                                Description
                                <input name="description" type="text" maxLength="120" placeholder="What was it for?" required value={expenseDraft.description} onChange={updateExpenseField} className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition placeholder:text-[#a2aaa4] focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15" />
                            </label>
                            <button type="submit" disabled={isLoading} className="h-11 self-end rounded-lg bg-[#1f5b45] px-5 text-sm font-bold text-white transition hover:bg-[#174936] focus:outline-none focus:ring-2 focus:ring-[#337b5b] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">Add expense</button>
                        </form>
                        {formError && <p className="mt-3 text-sm text-[#b04432]" role="alert">{formError}</p>}
                    </section>

                    <section className="mt-6 overflow-hidden rounded-xl border border-[#e3e9e3] bg-white" aria-labelledby="ledger-heading">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                            <h2 id="ledger-heading" className="font-display text-lg font-bold">Expenses for {monthName} {year}</h2>
                            <span className="text-xs font-semibold text-[#718078]">{visibleExpenses.length} {visibleExpenses.length === 1 ? "entry" : "entries"}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm md:min-w-162.5 md:table-auto">
                                <thead className="border-y border-[#edf0ed] bg-[#f7f9f6] text-xs font-semibold uppercase tracking-wide text-[#718078]">
                                    <tr>
                                        <th scope="col" className="w-[19%] px-1.5 py-3 sm:w-auto sm:px-6">Date</th>
                                        <th scope="col" className="w-[17%] px-1.5 py-3 md:w-auto md:px-5"><span className="md:hidden">Reason</span><span className="hidden md:inline">Category</span></th>
                                        <th scope="col" className="w-[25%] px-1.5 py-3 md:w-auto md:px-5"><span className="md:hidden">Value</span><span className="hidden md:inline">Description</span></th>
                                        <th scope="col" className="w-[23%] px-1 py-3 text-right md:w-auto md:px-5"><span className="md:hidden">₹</span><span className="hidden md:inline">Amount</span></th>
                                        <th scope="col" className="w-[16%] px-1 py-3 sm:w-auto sm:pr-6"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#edf0ed]">
                                    {visibleExpenses.length === 0 ? (
                                        <tr><td colSpan="5" className="px-6 py-10 text-center">
                                            <p className="font-semibold text-[#58665e]">No expenses for {monthName} yet</p>
                                            <p className="mt-1 text-sm text-[#87928b]">Add a dated expense above and it will count toward this month.</p>
                                        </td></tr>
                                    ) : visibleExpenses.map((expense) => (
                                        <tr key={expense.id}>
                                            <td className="wrap-break-word px-1.5 py-3.5 text-[10px] leading-tight text-[#58665e] sm:whitespace-nowrap sm:px-6 sm:text-sm">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${expense.date}T00:00:00`))}</td>
                                            <td className="px-1.5 py-3.5"><span className="inline-flex max-w-full wrap-break-word rounded-md bg-[#edf5ee] px-1 py-1 text-[10px] font-bold leading-tight text-[#286846] sm:px-2 sm:text-xs">{expense.category}</span></td>
                                            <td className="wrap-break-word px-1.5 py-3.5 text-[11px] leading-tight text-[#58665e] sm:max-w-65 sm:truncate sm:px-5 sm:text-sm" title={expense.description}>{expense.description}</td>
                                            <td className="whitespace-nowrap px-1 py-3.5 text-right text-[10px] font-semibold tabular-nums text-[#b95d40] sm:px-5 sm:text-sm" title={money(expense.amount)}><span className="md:hidden">{compactMoney(expense.amount)}</span><span className="hidden md:inline">{money(expense.amount)}</span></td>
                                            <td className="px-1 py-3.5 text-right sm:px-5 sm:pr-6"><button type="button" onClick={() => deleteExpense(expense.id)} className="rounded-md px-1 py-1 text-[10px] font-semibold text-[#718078] transition hover:bg-[#fff1ec] hover:text-[#a9422c] focus:outline-none focus:ring-2 focus:ring-[#b95d40]/30 sm:px-2 sm:text-xs">Remove</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </section>

                <section id="chart-panel" role="tabpanel" aria-labelledby="chart-tab" hidden={activeTab !== "chart"}>
                    <div className="rounded-xl border border-[#e3e9e3] bg-white p-5 sm:p-6">
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8980]">Monthly comparison</p>
                                <h1 className="mt-1 font-display text-xl font-bold">Income vs. expenses</h1>
                            </div>
                            <p className="text-sm text-[#718078]">All values in Indian rupees</p>
                        </div>
                        <div className="relative h-80 w-full sm:h-97.5">
                            <IncomeExpenseChart incomes={yearData.incomes} expenses={monthExpenses} active={activeTab === "chart"} />
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}