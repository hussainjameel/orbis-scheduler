import { LogoMark } from "@/components/logo";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Brand panel — unchanged between the form and success states,
          it's a brand element, not a progress indicator. */}
      <aside className="bg-text-primary px-10 py-8 sm:flex sm:w-[30%] sm:min-w-[280px] sm:max-w-[420px] sm:flex-col sm:items-start sm:justify-center sm:px-14 sm:py-12">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12 text-brand" />
          <span className="text-[42px] font-medium leading-none text-surface-0">
            Orbis
          </span>
        </div>
        <h2 className="mt-10 text-2xl font-medium text-surface-0">
          Start taking bookings.
        </h2>
        <p className="mt-2 text-base text-surface-0/70">
          Set up in minutes. Approved within a day.
        </p>
      </aside>

      {/* Form column — wider than login to fit the two-column field groups */}
      <main className="flex flex-1 items-start justify-center px-6 py-10 sm:items-center sm:px-10 sm:py-12">
        <div className="w-full max-w-[560px]">
          <RegisterForm />
        </div>
      </main>
    </div>
  );
}
