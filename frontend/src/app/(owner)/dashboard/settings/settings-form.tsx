"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { clientFetch, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function SettingsForm({
  name,
  bookingUrl,
  initialDescription,
  initialPhone,
  initialContactEmail,
  initialWebsiteUrl,
}: {
  name: string;
  bookingUrl: string;
  initialDescription: string | null;
  initialPhone: string | null;
  initialContactEmail: string | null;
  initialWebsiteUrl: string | null;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(initialDescription ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      // Named literal, not a spread of broader form state — name/slug must
      // never appear in this body at all, or the backend 400s (owner.ts
      // rejects the keys' mere presence, not just a changed value).
      const data = await clientFetch<{ message: string }>("/owner/business", {
        method: "PATCH",
        body: JSON.stringify({
          description: description.trim() || null,
          phone: phone.trim() || null,
          contactEmail: contactEmail.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
        }),
      });
      toast.success(data.message);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {submitting && <LoadingOverlay />}

      <div>
        <Label htmlFor="settings-name">
          <Lock className="size-3.5 text-text-muted" strokeWidth={1.5} />
          Business name
        </Label>
        <Input id="settings-name" value={name} disabled className="mt-1.5" />
        <p className="mt-1.5 text-xs text-text-secondary">Can&apos;t be changed after registration.</p>
      </div>

      <div>
        <Label htmlFor="settings-booking-url">
          <Lock className="size-3.5 text-text-muted" strokeWidth={1.5} />
          Booking URL
        </Label>
        <Input id="settings-booking-url" value={bookingUrl} disabled className="mt-1.5 font-mono" />
        <p className="mt-1.5 text-xs text-text-secondary">Permanent for the life of your business account.</p>
      </div>

      <div className="border-t border-border-default" />

      <div>
        <Label htmlFor="settings-description">
          Description <span className="font-normal text-text-muted">(optional)</span>
        </Label>
        <Textarea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description customers see on your booking page"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="settings-phone">
          Phone <span className="font-normal text-text-muted">(optional)</span>
        </Label>
        <Input
          id="settings-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="settings-contact-email">
          Contact email <span className="font-normal text-text-muted">(optional)</span>
        </Label>
        <Input
          id="settings-contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1.5 text-xs text-text-secondary">Shown to customers — separate from your login email.</p>
      </div>

      <div>
        <Label htmlFor="settings-website">
          Website <span className="font-normal text-text-muted">(optional)</span>
        </Label>
        <Input
          id="settings-website"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="mt-1.5"
        />
      </div>

      {submitError && (
        <p role="alert" className="border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
          {submitError}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          Save
        </Button>
      </div>
    </form>
  );
}
