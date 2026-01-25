import AuthGuard from "@/components/AuthGuard";

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
