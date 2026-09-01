import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = {
  title: "Forgot Password - CoupleConnect",
  description: "Reset your CoupleConnect password.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-abyss">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.08)_0%,transparent_100%)]" />
      </div>
      
      <div className="relative z-10 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
