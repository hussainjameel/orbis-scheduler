import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Brand panel — deliberate inversion within light mode.
          Background is text-primary, foreground is surface-0, so both
          flip together and contrast holds in either mode. */}
      <aside className="bg-text-primary px-6 py-8 sm:w-[30%] sm:min-w-[280px] sm:max-w-[420px] sm:px-10 sm:py-12">
        <p className="text-sm font-medium tracking-wide text-brand">ORBIS</p>
        <h2 className="mt-6 text-xl font-medium text-surface-0">
          Bookings, handled.
        </h2>
        <p className="mt-1.5 text-sm text-surface-0/70">
          Scheduling for small service businesses.
        </p>
      </aside>

      {/* Form column — form itself constrained and centred */}
      <main className="flex flex-1 items-start justify-center px-6 py-10 sm:items-center sm:px-10 sm:py-12">
        <div className="w-full max-w-[380px]">
          <LoginForm expired={params.expired === "1"} />
        </div>
      </main>
    </div>
  );
}
