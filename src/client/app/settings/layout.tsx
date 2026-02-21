import SettingsNav from "./SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-0px)]">
      <SettingsNav />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
