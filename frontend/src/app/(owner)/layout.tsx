export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Owner auth guard goes here (decision 10: enforced in layout, not middleware).
  return <>{children}</>;
}
