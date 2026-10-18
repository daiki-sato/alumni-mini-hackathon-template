"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { Countdown } from "./Countdown";

export function DeadlineWatcher({ closedAt }: { closedAt: string }) {
  const router = useRouter();
  const handleExpire = useCallback(() => router.refresh(), [router]);

  return <Countdown closedAt={closedAt} onExpire={handleExpire} />;
}
