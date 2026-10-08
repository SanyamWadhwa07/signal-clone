import { AuthGate } from "@/components/auth/auth-gate";
import { LoginFlow } from "@/components/auth/login-flow";

export default function LoginPage() {
  return (
    <AuthGate require="guest">
      <LoginFlow />
    </AuthGate>
  );
}
