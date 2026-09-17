import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {children}
      <BottomNav />
    </div>
  );
}
