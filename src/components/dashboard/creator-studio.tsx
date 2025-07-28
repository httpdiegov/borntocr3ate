"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function CreatorStudio({ className }: { className?: string }) {
  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-6 w-6" />
          Creator Studio
        </CardTitle>
        <CardDescription>
          Tu centro de herramientas para la creación de contenido con IA.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center items-center text-center">
        <div className="space-y-4">
            <p className="text-muted-foreground">
                Accede a herramientas avanzadas para la edición de video, generación de ideas y más.
            </p>
            <Button asChild className="w-full">
                <Link href="/creator-studio">
                    Ir al Creator Studio
                </Link>
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
