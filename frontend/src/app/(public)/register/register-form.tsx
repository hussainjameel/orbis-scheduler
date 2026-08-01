"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_SHAPE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function RegisterForm() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Structural checks only — anything with real logic round-trips.
    if (!businessName.trim() || !ownerName.trim() || !email.trim() || !password) {
      setError("Fill in your name, email, password, and business name.");
      return;
    }
    if (!EMAIL_SHAPE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!PASSWORD_SHAPE.test(password)) {
      setError("Password must be at least 8 characters and include a letter and a number.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          ownerName,
          email,
          password,
          phone,
          description,
          websiteUrl,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Includes the 409 duplicate-email case, shown verbatim.
        setError(data.error ?? "Something went wrong. Please try again.");
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
          <Check className="size-6 text-approved-text" />
        </div>
        <h1 className="mt-4 text-xl font-medium text-text-primary">
          Registration submitted
        </h1>
        <p className="mx-auto mt-2 max-w-[320px] text-sm text-text-secondary">
          An administrator will review your account shortly. We&apos;ll email{" "}
          <span className="text-text-primary">{submittedEmail}</span> once it&apos;s
          approved.
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
      <h1 className="text-2xl font-medium text-text-primary">Register your business</h1>
      <p className="mt-1 text-sm text-text-secondary">
        An admin reviews every registration before it goes live.
      </p>

      <div className="mt-6">
        <p className="text-xs font-medium tracking-wide text-text-muted uppercase">
          Your details
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ownerName">Your name</Label>
            <Input
              id="ownerName"
              type="text"
              autoComplete="name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1.5 h-11 sm:h-10"
            />
          </div>
          <div>
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
        </div>

        <div className="mt-4">
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
          <p className="mt-1.5 text-xs text-text-muted">
            8+ characters, with a letter and a number
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium tracking-wide text-text-muted uppercase">
          Your business
        </p>

        <div className="mt-4">
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            type="text"
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1.5 h-11 sm:h-10"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">
              Phone <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 h-11 sm:h-10"
            />
          </div>
          <div>
            <Label htmlFor="websiteUrl">
              Website <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="websiteUrl"
              type="url"
              autoComplete="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="mt-1.5 h-11 sm:h-10"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="description">
            Description <span className="font-normal text-text-muted">(optional)</span>
          </Label>
          <Textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="mt-6 h-11 w-full sm:h-10"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
      </Button>

      <p className="mt-5 flex flex-col items-center gap-1 text-center text-sm text-text-secondary sm:flex-row sm:justify-center">
        <span>Already have an account?</span>
        <Link
          href="/login"
          className="text-brand underline underline-offset-2 hover:text-brand/80"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
