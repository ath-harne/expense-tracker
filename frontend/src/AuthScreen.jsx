import { useState } from "react";
import { loginAccount, registerAccount } from "./api.js";

export default function AuthScreen({ onAuthenticated, initialError = "" }) {
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [error, setError] = useState(initialError);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isRegistering = mode === "register";

    async function submit(event) {
        event.preventDefault();
        setError("");
        if (isRegistering && password !== confirmation) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = isRegistering
                ? await registerAccount(email, password)
                : await loginAccount(email, password);
            onAuthenticated(result.user);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    function changeMode(nextMode) {
        setMode(nextMode);
        setError("");
        setPassword("");
        setConfirmation("");
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f3f5f2] px-4 py-10 font-sans text-[#202923] antialiased">
            <section className="w-full max-w-md rounded-xl border border-[#e3e9e3] bg-white p-6 shadow-sm sm:p-8">
                <a className="mb-8 flex items-center gap-3" href="#" aria-label="bucks2bars home">
                    <span className="flex h-10 w-10 items-end justify-center gap-1 rounded-xl bg-[#1f5b45] px-2 pb-2" aria-hidden="true">
                        <span className="h-3 w-1.5 rounded-sm bg-[#a6d5b1]" />
                        <span className="h-5 w-1.5 rounded-sm bg-white" />
                        <span className="h-7 w-1.5 rounded-sm bg-[#f1a76f]" />
                    </span>
                    <span>
                        <span className="block font-display text-lg font-extrabold leading-tight">bucks2bars</span>
                        <span className="block text-xs text-[#718078]">Your year, in balance</span>
                    </span>
                </a>

                <div className="mb-6 grid grid-cols-2 border-b border-[#dce4dc]" role="tablist" aria-label="Account access">
                    <button type="button" role="tab" aria-selected={!isRegistering} onClick={() => changeMode("login")} className={`border-b-2 px-3 py-3 text-sm transition ${!isRegistering ? "border-[#1f704d] font-bold text-[#1f704d]" : "border-transparent font-semibold text-[#718078] hover:text-[#202923]"}`}>Log in</button>
                    <button type="button" role="tab" aria-selected={isRegistering} onClick={() => changeMode("register")} className={`border-b-2 px-3 py-3 text-sm transition ${isRegistering ? "border-[#1f704d] font-bold text-[#1f704d]" : "border-transparent font-semibold text-[#718078] hover:text-[#202923]"}`}>Create account</button>
                </div>

                <h1 className="font-display text-2xl font-bold">{isRegistering ? "Create your account" : "Welcome back"}</h1>
                <p className="mt-1 text-sm text-[#718078]">{isRegistering ? "Your expenses will be private to your account." : "Log in to see your income and expenses."}</p>

                <form className="mt-6 space-y-4" onSubmit={submit}>
                    <label className="block text-sm font-semibold text-[#46534b]">
                        Email
                        <input type="email" name="email" autoComplete="email" maxLength="254" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15" />
                    </label>
                    <label className="block text-sm font-semibold text-[#46534b]">
                        Password
                        <input type="password" name="password" autoComplete={isRegistering ? "new-password" : "current-password"} minLength="8" maxLength="72" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15" />
                    </label>
                    {isRegistering && (
                        <label className="block text-sm font-semibold text-[#46534b]">
                            Confirm password
                            <input type="password" name="passwordConfirmation" autoComplete="new-password" minLength="8" maxLength="72" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 font-normal text-[#202923] outline-none transition focus:border-[#337b5b] focus:ring-2 focus:ring-[#337b5b]/15" />
                        </label>
                    )}
                    {error && <p className="text-sm text-[#b04432]" role="alert">{error}</p>}
                    <button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-lg bg-[#1f5b45] px-5 text-sm font-bold text-white transition hover:bg-[#174936] focus:outline-none focus:ring-2 focus:ring-[#337b5b] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
                        {isSubmitting ? "Please wait..." : isRegistering ? "Create account" : "Log in"}
                    </button>
                </form>
            </section>
        </main>
    );
}