import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { apiFetch, ApiError } from "@/lib/api";
import { OwnerSidebar } from "@/components/owner-sidebar";
import { OwnerMobileNav } from "@/components/owner-mobile-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { LogoMark } from "@/components/logo";

type OwnerBusiness = {
  name: string;
  owner: { name: string; email: string };
};

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // A valid session on the wrong role's routes is a silent redirect, not an
  // error page (decision 13).
  if (session.role !== "owner") redirect("/admin");

  let business: OwnerBusiness;
  try {
    const data = await apiFetch<{ business: OwnerBusiness }>("/owner/business");
    business = data.business;
  } catch (err) {
    // requireApprovedBusiness's pending/rejected/suspended 403s — a broken
    // dashboard behind a working shell is worse than an honest blocked
    // screen. A 401 never reaches here: apiFetch already hard-redirects to
    // /login on those. Anything else propagates as a genuine error.
    if (err instanceof ApiError && err.status === 403) {
      const body = err.body as { error?: string; reason?: string } | null;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <LogoMark className="size-8 text-brand" />
          <h1 className="mt-4 text-xl font-medium text-text-primary">Account status</h1>
          <p className="mt-2 max-w-[360px] text-sm text-text-secondary">
            {body?.error ?? "Something went wrong. Please try again."}
          </p>
          {body?.reason && (
            <p className="mt-2 max-w-[360px] text-sm text-text-muted">Reason: {body.reason}</p>
          )}
          <SignOutButton className="mt-6" />
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden sm:flex-row">
      <OwnerSidebar
        businessName={business.name}
        ownerEmail={business.owner.email}
        pendingCount={0}
      />
      <OwnerMobileNav />
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 pb-24 sm:px-8 sm:py-8 sm:pb-8">{children}</main>
    </div>
  );
}
