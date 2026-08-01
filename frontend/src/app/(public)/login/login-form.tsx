"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ expired }: { expired: boolean }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    expired ? "Your session expired. Please sign in again." : null
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Structural checks only — anything with real logic round-trips.
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!EMAIL_SHAPE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Includes 403 business-status messages, shown verbatim.
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push(data.user?.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-2xl font-medium text-text-primary">Sign in</h1>
      <p className="mt-1 text-sm text-text-secondary">Welcome back.</p>

      <div className="mt-6">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 h-11 sm:h-10"
        />
      </div>

      <div className="mt-4">
        <Label htmlFor="password">Password</Label>
        <div className="relative mt-1.5">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pr-10 sm:h-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        <div className="mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-brand underline underline-offset-2 hover:text-brand/80"
          >
            <span className="sm:hidden">Forgot?</span>
            <span className="hidden sm:inline">Forgot password?</span>
          </Link>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="mt-5 h-11 w-full sm:h-10"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
      </Button>

      <p className="mt-5 flex flex-col items-center gap-1 text-center text-sm text-text-secondary sm:flex-row sm:justify-center">
        <span>Don&apos;t have an account?</span>
        <Link
          href="/register"
          className="text-brand underline underline-offset-2 hover:text-brand/80"
        >
          Register your business
        </Link>
      </p>
    </form>
  );
}
