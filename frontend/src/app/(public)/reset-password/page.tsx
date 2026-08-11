import { PublicSidebar } from "@/components/public-sidebar";
import { InvalidResetLink } from "./invalid-link";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <PublicSidebar
      headline="Set a new password."
      tagline="Choose something you'll remember."
    >
      {/* A form with no token can only ever fail, so it's never shown. */}
      {token ? <ResetPasswordForm token={token} /> : <InvalidResetLink />}
    </PublicSidebar>
  );
}
