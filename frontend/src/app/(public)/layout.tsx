export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No auth guard — public routes (landing, auth screens, public booking page).
  return <>{children}</>;
}
