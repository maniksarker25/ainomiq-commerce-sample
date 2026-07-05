"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";


export function SuccessState() {
  return (
    <Card className="max-w-2xl mx-auto rounded-2xl text-center">
      <CardContent className="p-8">
        <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 mx-auto flex items-center justify-center mb-4">
          <Check className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          CS onboarding completed
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Your voice + number setup is saved. You can now open the Intelli
          Support dashboard.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            onClick={() => (window.location.href = "/dashboard/cs")}
            className="rounded-xl px-5 py-3 h-auto"
          >
            Open CS dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/dashboard/settings")}
            className="rounded-xl px-5 py-3 h-auto"
          >
            Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
