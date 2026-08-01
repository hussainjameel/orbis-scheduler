"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoSpinner } from "@/components/logo";
import { InvalidResetLink } from "./invalid-link";

const PASSWORD_SHAPE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Structural checks only — anything with real logic round-trips.
    // The match check is the one exception: the server only ever receives
    // one password, so it can't perform it — it belongs here.
    if (!newPassword || !confirmPassword) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (!PASSWORD_SHAPE.test(newPassword)) {
      setError("Password must be at least 8 characters and include a letter and a number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      // A dead token makes the form pointless — swap to the full
      // invalid-link state rather than an inline error the user could
      // still try to resubmit.
      if (res.status === 400) {
        setInvalidToken(true);
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // No cookie, no auto-login — the login screen shows the confirmation.
      router.push("/login?reset=1");
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  if (invalidToken) {
    return <InvalidResetLink />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-2xl font-medium text-text-primary">Set a new password</h1>

      <div className="mt-6">
        <Label htmlFor="newPassword">New password</Label>
        <div className="relative mt-1.5">
          <Input
            id="newPassword"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-11 pr-10 sm:h-10"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            aria-label={showNewPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary"
          >
            {showNewPassword ? (
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

      <div className="mt-4">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <div className="relative mt-1.5">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-11 pr-10 sm:h-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary"
          >
            {showConfirmPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
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

      <Button type="submit" disabled={loading} className="mt-5 h-11 w-full sm:h-10">
        {loading ? (
          <LogoSpinner className="size-4 text-brand-on" />
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}
