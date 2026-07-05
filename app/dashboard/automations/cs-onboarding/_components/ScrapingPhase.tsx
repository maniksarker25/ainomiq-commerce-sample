"use client";

import { Loader2 } from "lucide-react";
import { ProgressBar } from "./ProgressBar";


export function ScrapingPhase({
  currentStep,
  message,
}: {
  currentStep: string;
  message: string;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <svg
            className="w-7 h-7 text-gray-900 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <ProgressBar currentStep={currentStep} />
        <p className="text-sm text-gray-500 mt-6 animate-pulse">{message}</p>
      </div>
    </div>
  );
}
