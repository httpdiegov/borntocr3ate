"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Film, Bot, Loader2, Scissors, Download } from "lucide-react";
import { analyzeVideoContent, type AnalyzedClip } from "@/ai/flows/analyze-video-content";
import { Badge } from "../ui/badge";

export default function VideoClipper({ className }: { className?: string }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [clips, setClips] = useState<AnalyzedClip[]>([]);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setVideoFile(file);
        setClips([]);
        toast({ title: "Video cargado", description: file.name });
      } else {
        toast({
          title: "Archivo no válido",
          description: "Por favor, selecciona un archivo de video.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      toast({
        title: "No hay video",
        description: "Por favor, carga un video primero.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setClips([]);

    try {
      // En una implementación real, aquí leerías el audio, lo transcribirías,
      // y pasarías la transcripción al flujo.
      // Por ahora, pasamos un texto simulado.
      const fakeTranscription = "Este es el texto simulado de un video largo donde se discuten temas de IA, se habla de Opus Clip y vizard.ai y se pregunta cómo recrearlo. Este es el primer clip viral. Luego, se explican los desafíos técnicos del procesamiento de video. Finalmente, se propone una solución con Python y n8n, este es el segundo momento clave.";
      const result = await analyzeVideoContent({ transcription: fakeTranscription });
      
      setClips(result.clips);
      toast({
        title: "Análisis completado",
        description: `Se han identificado ${result.clips.length} clips potenciales.`,
      });

    } catch (error) {
      console.error("Error analyzing video:", error);
      toast({
        title: "Error en el análisis",
        description: "No se pudieron generar los clips.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-6 w-6" />
          Video Clipper
        </CardTitle>
        <CardDescription>
          Sube un video y la IA encontrará los momentos clave para crear clips cortos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2">
          <Input type="file" accept="video/*" onChange={handleFileChange} disabled={isAnalyzing} />
          <Button onClick={handleAnalyze} className="w-full" disabled={!videoFile || isAnalyzing}>
            {isAnalyzing ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <Bot className="mr-2" />
            )}
            {isAnalyzing ? "Analizando..." : "Encontrar Clips Virales"}
          </Button>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {isAnalyzing && (
             <div className="text-center text-muted-foreground py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>La IA está analizando el contenido...</p>
              </div>
          )}
          {clips.length > 0 ? (
            clips.map((clip) => (
              <Card key={clip.id} className="bg-card/50">
                <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                        <p className="text-sm font-semibold text-card-foreground break-words w-full">
                            {clip.title}
                        </p>
                         <Badge variant="secondary">{clip.timestamp}</Badge>
                    </div>
                  <p className="text-sm text-muted-foreground break-words w-full">
                    {clip.summary}
                  </p>
                  <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="w-full" disabled>
                        <Scissors className="mr-2 h-4 w-4"/>
                        Crear Clip (Próximamente)
                      </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            !isAnalyzing && (
                <div className="text-center text-muted-foreground py-12">
                    <p>Carga un video para empezar.</p>
                </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
