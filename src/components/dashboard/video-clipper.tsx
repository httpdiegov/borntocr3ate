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
import { Film, Bot, Loader2, Scissors, WholeWord } from "lucide-react";
import { transcribeVideo } from "@/ai/flows/transcribe-video";
import { analyzeVideoContent, type AnalyzedClip } from "@/ai/flows/analyze-video-content";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";

// Helper to convert a File to a Base64 Data URI
const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};


export default function VideoClipper({ className }: { className?: string }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [clips, setClips] = useState<AnalyzedClip[]>([]);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setVideoFile(file);
        setClips([]);
        setTranscription(null);
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
  
  const handleTranscribe = async () => {
    if (!videoFile) return;

    setIsTranscribing(true);
    setTranscription(null);
    setClips([]);
    toast({ title: "Iniciando transcripción...", description: "La IA está procesando el video. Esto puede tardar unos minutos." });

    try {
        const videoDataUri = await fileToDataUri(videoFile);
        const result = await transcribeVideo({ 
          videoDataUri: videoDataUri, 
          contentType: videoFile.type 
        });
        setTranscription(result.transcription);
        toast({ title: "¡Transcripción completada!", description: "Ahora puedes analizar el texto para encontrar clips."});
    } catch (error) {
        console.error("Error transcribing video:", error);
        toast({
          title: "Error en la transcripción",
          description: "No se pudo transcribir el video. Revisa la consola para más detalles.",
          variant: "destructive",
        });
    } finally {
        setIsTranscribing(false);
    }
  }


  const handleAnalyze = async () => {
    if (!transcription) {
      toast({
        title: "No hay transcripción",
        description: "Por favor, transcribe el video primero.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setClips([]);

    try {
      const result = await analyzeVideoContent({ transcription });
      
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
  
  const isLoading = isTranscribing || isAnalyzing;

  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-6 w-6" />
          Video Clipper
        </CardTitle>
        <CardDescription>
          Sube un video, la IA lo transcribirá y encontrará los momentos clave para crear clips.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2">
          <Input type="file" accept="video/*" onChange={handleFileChange} disabled={isLoading} />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleTranscribe} className="w-full" disabled={!videoFile || isLoading}>
                {isTranscribing ? <Loader2 className="animate-spin mr-2" /> : <WholeWord className="mr-2" />}
                {isTranscribing ? "Transcribiendo..." : "1. Transcribir"}
            </Button>
            <Button onClick={handleAnalyze} className="w-full" disabled={!transcription || isLoading}>
                {isAnalyzing ? <Loader2 className="animate-spin mr-2" /> : <Bot className="mr-2" />}
                {isAnalyzing ? "Analizando..." : "2. Encontrar Clips"}
            </Button>
          </div>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {isLoading && (
             <div className="text-center text-muted-foreground py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>
                    {isTranscribing ? "Transcribiendo video... Esto puede tardar." : "La IA está analizando el contenido..."}
                </p>
              </div>
          )}

          {transcription && !isTranscribing && (
            <div>
              <h3 className="font-semibold mb-2">Transcripción del Video:</h3>
              <Textarea 
                readOnly 
                value={transcription} 
                className="h-32 bg-muted/50"
                placeholder="Aquí aparecerá la transcripción..."
              />
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
            !isLoading && !transcription && (
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