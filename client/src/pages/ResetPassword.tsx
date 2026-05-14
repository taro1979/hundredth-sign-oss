import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const reset = trpc.auth.resetPassword.useMutation();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <form
        className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          reset.mutate({ token, password });
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
        <label className="mt-6 block text-sm font-medium">New password</label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        {reset.error ? <p className="mt-3 text-sm text-red-600">{reset.error.message}</p> : null}
        {reset.isSuccess ? <p className="mt-3 text-sm text-emerald-700">Password updated.</p> : null}
        <button className="mt-6 w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={reset.isPending || !token}>
          Update password
        </button>
        <Link href="/login" className="mt-4 block text-center text-sm text-emerald-700 underline">Back to sign in</Link>
      </form>
    </main>
  );
}
