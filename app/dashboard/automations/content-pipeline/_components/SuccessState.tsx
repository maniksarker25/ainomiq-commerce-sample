import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import Link from "next/link";

export function SuccessState() {
  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl rounded-[32px] border border-blue-100 bg-white p-10 shadow-sm text-center">
        <div className="flex items-center justify-center mx-auto mb-6 bg-blue-50 h-16 w-16 rounded-2xl border border-blue-100 shadow-sm">
          <Check className="text-blue-600 h-8 w-8" />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-3">
          Connection Success
        </div>
        <h1 className="text-3xl font-black text-gray-950 tracking-tight">
          Content Studio Connected
        </h1>
        <p className="max-w-xl mx-auto mt-3 text-gray-600 leading-relaxed">
          Your Meta channels are linked and the Content Studio is now active for this workspace. You can start generating and scheduling content.
        </p>
        <div className="grid grid-cols-1 gap-4 mt-10 sm:grid-cols-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 font-bold shadow-md shadow-blue-100">
            <Link href="/dashboard/content-pipeline">Open Content Studio</Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl h-12 border-gray-200 text-gray-700 hover:bg-gray-50 font-bold bg-white">
            <Link href="/dashboard/automations">View All Automations</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
