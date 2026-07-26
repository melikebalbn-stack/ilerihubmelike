import IaNav from "./IaNav";

export default function IsAnaliziLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <IaNav />
      {children}
    </div>
  );
}
