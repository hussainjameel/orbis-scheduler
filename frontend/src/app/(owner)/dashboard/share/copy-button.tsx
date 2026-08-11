"use client";

import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  toastMessage,
  className,
  variant = "default",
}: {
  text: string;
  toastMessage: string;
  className?: string;
  variant?: "default" | "secondary" | "ghost";
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    toast.success(toastMessage);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button type="button" variant={variant} size="sm" onClick={handleCopy} className={cn(className)}>
      {copied ? <Check className="size-3.5" strokeWidth={1.5} /> : <Copy className="size-3.5" strokeWidth={1.5} />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
