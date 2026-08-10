import { apiFetch } from "@/lib/api";
import { getOrigin } from "@/lib/origin";
import { CopyButton } from "./copy-button";
import { EmbedSnippet } from "./embed-snippet";
import { QrSection } from "./qr-section";
import { TestBookingPageButton } from "./test-booking-page-button";

export default async function SharePage() {
  const [{ business }, origin] = await Promise.all([
    apiFetch<{ business: { id: string } }>("/owner/business"),
    getOrigin(),
  ]);

  const bookingUrl = `${origin}/book/${business.id}`;
  // data-business-id is a placeholder attribute name — widget.js doesn't
  // exist yet (decision 6: vanilla JS served from /public, separate work).
  const embedSnippet = `<script src="${origin}/widget.js" data-business-id="${business.id}"></script>`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-medium text-text-primary">Share &amp; embed</h1>
          <p className="text-sm text-text-secondary">
            Get your booking link, embed it on your site, or download a QR code.
          </p>
        </div>
        <TestBookingPageButton bookingUrl={bookingUrl} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-border-default bg-surface-2 p-4">
          <h2 className="mb-1 text-xl font-medium text-text-primary">Booking link</h2>
          <p className="mb-3 text-sm text-text-secondary">Share this link directly with customers.</p>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto rounded-sm border border-border-default bg-surface-1 px-3 py-2">
              <span className="font-mono text-sm whitespace-nowrap text-text-primary">{bookingUrl}</span>
            </div>
            <CopyButton text={bookingUrl} toastMessage="Link copied" />
          </div>
        </div>

        <div className="rounded-md border border-border-default bg-surface-2 p-4">
          <h2 className="mb-1 text-xl font-medium text-text-primary">Embed on your website</h2>
          <p className="mb-3 text-sm text-text-secondary">
            Paste this snippet before the closing &lt;/body&gt; tag to add a booking button to your site.
          </p>
          <div className="flex items-start gap-2">
            <EmbedSnippet snippet={embedSnippet} />
            <CopyButton text={embedSnippet} toastMessage="Snippet copied" />
          </div>
        </div>

        <div className="rounded-md border border-border-default bg-surface-2 p-4">
          <h2 className="mb-1 text-xl font-medium text-text-primary">QR code</h2>
          <p className="mb-3 text-sm text-text-secondary">Scan to open your booking page, or download it for print.</p>
          <QrSection bookingUrl={bookingUrl} />
        </div>
      </div>
    </div>
  );
}
