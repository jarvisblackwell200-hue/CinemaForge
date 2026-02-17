import { Header } from "@/components/layout/Header";
import { MovieSidebarWrapper } from "@/components/layout/MovieSidebarWrapper";

export default function MovieLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ movieId: string }>;
}) {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <MovieSidebarWrapper params={params} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
