import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface Props {
  generated: any;
  labelFor: (type: string) => string;
}

export function GeneratedPreview({ generated, labelFor }: Props) {
  if (!generated) return null;

  return (
    <div className="pt-10 space-y-6">
      <div className="flex items-center gap-2 px-2">
        <Sparkles className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-black text-gray-950 tracking-tight">Generated Content Preview</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        {generated.outputs?.map((item: any, idx: number) => (
          <Card key={idx} className="rounded-[24px] border-gray-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
            <CardHeader className="p-5 border-b border-gray-50 bg-gray-50/50">
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest text-blue-600 border-blue-100 bg-blue-50/50 px-2 py-0.5 rounded-md">
                {labelFor(item.type)}
              </Badge>
            </CardHeader>
            <CardContent className="p-6">
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100/50">
                <pre className="font-sans text-sm text-gray-800 whitespace-pre-wrap leading-relaxed italic">
                  "{item.content}"
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
