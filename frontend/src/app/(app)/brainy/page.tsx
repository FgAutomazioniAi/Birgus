import { BrainyPanel } from "@/features/brainy/brainy-panel";
import { Suspense } from "react";

export default function BrainyPage() {
  return (
    <Suspense>
      <BrainyPanel />
    </Suspense>
  );
}
