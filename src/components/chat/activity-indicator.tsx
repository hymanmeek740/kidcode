"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ActivityIndicatorProps {
  activity: string;
}

export function ActivityIndicator({ activity }: ActivityIndicatorProps) {
  return (
    <div className="flex justify-start">
      <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">{activity}</span>
      </Badge>
    </div>
  );
}
