async function request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result.error || "The server could not complete this request.");
        error.status = response.status;
        throw error;
    }
    return result;
}

export function getYear(year, signal) {
    return request(`/years/${year}`, { signal });
}

export function saveIncome(year, month, amount) {
    return request(`/years/${year}/incomes/${month}`, {
        method: "PUT",
        body: JSON.stringify({ amount })
    });
}

export function addExpense(year, expense) {
    return request(`/years/${year}/expenses`, {
        method: "POST",
        body: JSON.stringify(expense)
    });
}

export function removeExpense(year, expenseId) {
    return request(`/years/${year}/expenses/${expenseId}`, { method: "DELETE" });
}

export async function getCurrentUser(signal) {
    try {
        const result = await request("/auth/me", { signal });
        return result.user;
    } catch (error) {
        if (error.status === 401) return null;
        throw error;
    }
}

export function registerAccount(email, password) {
    return request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });
}

export function loginAccount(email, password) {
    return request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });
}

export function logoutAccount() {
    return request("/auth/logout", { method: "POST" });
}