import { PublicSidebar } from "@/components/public-sidebar";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; reset?: string }>;
}) {
  const params = await searchParams;

  return (
    <PublicSidebar
      headline="Bookings, handled."
      tagline="Scheduling for small service businesses."
    >
      <LoginForm
        expired={params.expired === "1"}
        resetSuccess={params.reset === "1"}
      />
    </PublicSidebar>
  );
}
