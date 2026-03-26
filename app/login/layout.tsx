export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4A027D 0%, #2a0050 100%)' }}>
      {children}
    </div>
  );
}
