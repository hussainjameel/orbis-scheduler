"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoSpinner } from "@/components/logo";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Structural checks only — anything with real logic round-trips.
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!EMAIL_SHAPE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // The backend returns the same response whether or not the account
      // exists — any success response shows the same confirmation, never
      // branching on what's inside it.
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSubmittedEmail(email);
      setLoading(false);
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (submittedEmail) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-approved">
          <Mail className="size-6 text-approved-text" />
        </div>
        <h1 className="mt-4 text-xl font-medium text-text-primary">Check your email</h1>
        <p className="mx-auto mt-2 max-w-[320px] text-sm text-text-secondary">
          If an account exists for{" "}
          <span className="text-text-primary">{submittedEmail}</span>, we&apos;ve sent
          a link to reset your password. The link expires in one hour.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-brand underline underline-offset-2 hover:text-brand/80"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-2xl font-medium text-text-primary">Reset your password</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Enter the email you registered with.
      </p>

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

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text"
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="mt-5 h-11 w-full sm:h-10">
        {loading ? (
          <LogoSpinner className="size-4 text-brand-on" />
        ) : (
          "Send reset link"
        )}
      </Button>

      <p className="mt-5 text-center text-sm text-text-secondary">
        <Link
          href="/login"
          className="text-brand underline underline-offset-2 hover:text-brand/80"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
