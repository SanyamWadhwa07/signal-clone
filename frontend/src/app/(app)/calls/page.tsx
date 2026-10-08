import { Phone } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export default function CallsPage() {
  return (
    <ComingSoon
      title="Calls"
      icon={<Phone size={28} />}
      description="Voice and video calls will show up here."
    />
  );
}
