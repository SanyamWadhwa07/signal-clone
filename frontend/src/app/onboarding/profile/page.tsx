import { AuthGate } from "@/components/auth/auth-gate";
import { ProfileForm } from "@/components/auth/profile-form";

export default function OnboardingProfilePage() {
  return (
    <AuthGate require="profile">
      <main className="flex min-h-dvh items-center justify-center overflow-y-auto bg-chat px-4 py-10">
        <div className="w-full max-w-[400px] text-center">
          <h1 className="text-2xl font-semibold">Your profile</h1>
          <p className="mt-2 mb-8 text-sm text-fg-2">Choose how you appear to your contacts.</p>
          <ProfileForm />
        </div>
      </main>
    </AuthGate>
  );
}
