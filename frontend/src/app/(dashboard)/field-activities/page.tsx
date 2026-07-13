"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FieldActivitiesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pengamatan/logbook");
  }, [router]);
  return null;
}
