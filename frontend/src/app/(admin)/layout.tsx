export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin auth guard goes here (decision 10: enforced in layout, not middleware).
  return <>{children}</>;
}
