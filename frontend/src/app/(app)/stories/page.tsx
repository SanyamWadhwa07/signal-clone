import { StoriesIcon } from "@/components/ui/icons";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function StoriesPage() {
  return (
    <ComingSoon
      title="Stories"
      icon={<StoriesIcon size={28} />}
      description="Share updates that disappear after 24 hours."
    />
  );
}
