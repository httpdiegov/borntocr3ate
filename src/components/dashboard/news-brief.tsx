"use client";

import React, { useState } from "react";
import { useFormStatus } from "react-dom";
import { handleGenerateNewsBrief } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, RefreshCw } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface NewsItem {
  title: string;
  summary: string;
}

interface NewsBriefState {
  newsItems: NewsItem[] | null;
  message: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <RefreshCw className={`mr-2 h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
      {pending ? "Generando..." : "Generar Noticias"}
    </Button>
  );
}

export default function NewsBrief({ className }: { className?: string }) {
  const [state, setState] = useState<NewsBriefState>({ newsItems: null, message: "" });
  const { pending } = useFormStatus();

  const handleSubmit = async (formData: FormData) => {
    const result = await handleGenerateNewsBrief(null, formData);
    setState(result);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Noticias Relevantes
        </CardTitle>
        <CardDescription>
          Las 5 noticias más importantes del día, generadas por IA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <SubmitButton />
        </form>
        {state.message === "failed" && (
          <p className="text-destructive mt-4">{state.message}</p>
        )}
        <div className="mt-6">
          {pending ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                   <Skeleton className="h-4 w-5/6" />
                </div>
              ))}
            </div>
          ) : (
            state.newsItems && (
              <Accordion type="single" collapsible className="w-full">
                {state.newsItems.map((item, index) => (
                  <AccordionItem value={`item-${index}`} key={index}>
                    <AccordionTrigger>{item.title}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.summary}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
