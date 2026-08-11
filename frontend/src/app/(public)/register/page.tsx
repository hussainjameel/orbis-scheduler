import { PublicSidebar } from "@/components/public-sidebar";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <PublicSidebar
      headline="Start taking bookings."
      tagline="Set up in minutes. Approved within a day."
      maxWidth="560px"
    >
      <RegisterForm />
    </PublicSidebar>
  );
}
