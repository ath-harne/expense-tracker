async function request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.error || "The server could not complete this request.");
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