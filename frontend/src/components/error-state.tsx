"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  heading = "Something went wrong",
  body = "Please try again.",
}: {
  heading?: string;
  body?: string;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-[300px] flex-col items-center py-12 text-center">
      <AlertCircle className="size-6 text-rejected-text" strokeWidth={1.5} />
      <h2 className="mt-3 text-base font-medium text-text-primary">{heading}</h2>
      <p className="mt-2 text-sm text-text-secondary">{body}</p>
      <Button className="mt-4" onClick={() => router.refresh()}>
        Try again
      </Button>
    </div>
  );
}
