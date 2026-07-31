// "use client";

// import { useState, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { Loader2 } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";

// const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// export function LoginForm({ expired }: { expired: boolean }) {
//   const router = useRouter();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(
//     expired ? "Your session expired. Please sign in again." : ""
//   );

//   async function handleSubmit(e: FormEvent<HTMLFormElement>) {
//     e.preventDefault();

//     if (!email || !password) {
//       setError("Email and password are required.");
//       return;
//     }
//     if (!EMAIL_RULE.test(email)) {
//       setError("Enter a valid email address.");
//       return;
//     }

//     setError("");
//     setLoading(true);

//     try {
//       const res = await fetch("/api/auth/login", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         setError(data.error || "Something went wrong, please try again");
//         setLoading(false);
//         return;
//       }

//       router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
//     } catch {
//       setError("Something went wrong, please try again");
//       setLoading(false);
//     }
//   }

//   return (
//     <div>
//       <h1 className="text-2xl font-medium text-text-primary">Sign in</h1>
//       <p className="mt-1 text-sm text-text-secondary">Welcome back.</p>

//       <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
//         <div>
//           <Label htmlFor="email">Email</Label>
//           <Input
//             id="email"
//             name="email"
//             type="email"
//             autoComplete="email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             disabled={loading}
//             className="mt-1.5 h-11 sm:h-10"
//           />
//         </div>

//         <div>
//           <div className="flex items-baseline justify-between">
//             <Label htmlFor="password">Password</Label>
//             <Link
//               href="/forgot-password"
//               className="text-sm text-text-primary underline underline-offset-2 hover:text-text-secondary"
//             >
//               <span className="sm:hidden">Forgot?</span>
//               <span className="hidden sm:inline">Forgot password?</span>
//             </Link>
//           </div>
//           <Input
//             id="password"
//             name="password"
//             type="password"
//             autoComplete="current-password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             disabled={loading}
//             className="mt-1.5 h-11 sm:h-10"
//           />
//         </div>

//         {error && (
//           <p
//             role="alert"
//             className="border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text"
//           >
//             {error}
//           </p>
//         )}

//         <Button type="submit" disabled={loading} className="h-11 w-full sm:h-10">
//           {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
//         </Button>
//       </form>

//       <p className="mt-6 text-sm text-text-secondary">
//         Don&apos;t have an account?{" "}
//         <Link
//           href="/register"
//           className="text-text-primary underline underline-offset-2 hover:text-text-secondary"
//         >
//           Register your business
//         </Link>
//       </p>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

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
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-sm text-text-secondary underline underline-offset-2 hover:text-text-primary"
          >
            <span className="sm:hidden">Forgot?</span>
            <span className="hidden sm:inline">Forgot password?</span>
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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

      <Button
        type="submit"
        disabled={loading}
        className="mt-5 h-11 w-full sm:h-10"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
      </Button>

      <p className="mt-5 text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-text-primary underline underline-offset-2"
        >
          Register your business
        </Link>
      </p>
    </form>
  );
}
