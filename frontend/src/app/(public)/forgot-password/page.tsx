import { PublicSidebar } from "@/components/public-sidebar";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <PublicSidebar
      headline="Forgot your password?"
      tagline="We'll email you a link to set a new one."
    >
      <ForgotPasswordForm />
    </PublicSidebar>
  );
}
