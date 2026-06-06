export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F1F8E9] via-white to-[#F1F8E8] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Décoration : grandes bulles vertes en arrière-plan */}
      <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-[#87C241]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-150px] left-[-100px] w-[500px] h-[500px] bg-[#43793F]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {children}

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 TIM SARL · TontineX360 — Tech Intelligence & Management, Douala
        </p>
      </div>
    </div>
  );
}
