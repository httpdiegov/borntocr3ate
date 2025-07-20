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
import { Film, Bot, Loader2, Scissors, WholeWord, User, Clock } from "lucide-react";
import { analyzeVideoContent, type AnalyzedClip, type Speaker } from "@/ai/flows/analyze-video-content";
import { generateUploadUrl } from "@/ai/flows/generate-upload-url";
import { finalizeUpload } from "@/ai/flows/finalize-upload";
import { Badge } from "../ui/badge";

const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const formatTimestamp = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};


export default function VideoClipper({ className }: { className?: string }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{clips: AnalyzedClip[], speakers: Speaker[]} | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setVideoFile(file);
        setAnalysisResult(null);
        toast({ title: "Video selected", description: file.name });
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a video file.",
          variant: "destructive",
        });
      }
    }
  };
  
  const handleAnalyze = async () => {
    if (!videoFile) return;

    setAnalysisResult(null);
    setIsUploading(true);

    const safeFilename = sanitizeFilename(videoFile.name);
    let publicUrl: string;

    try {
      // 1. Get signed URL
      toast({ title: "Preparando subida segura..." });
      const { signedUrl, gcsUri, publicUrl: generatedPublicUrl } = await generateUploadUrl({
        filename: safeFilename,
        contentType: videoFile.type,
      });
      publicUrl = generatedPublicUrl;

      // 2. Upload file directly to GCS
      toast({ title: "Subiendo video...", description: "Tu archivo se está subiendo directamente al almacenamiento seguro." });
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: videoFile,
        headers: { 'Content-Type': videoFile.type },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }
      toast({ title: "Subida completa!" });
      
      // 3. Finalize upload by making the file public
      toast({ title: "Finalizando archivo..." });
      const finalizeResult = await finalizeUpload({ gcsUri });
      if (!finalizeResult.success) {
        throw new Error(finalizeResult.message);
      }

    } catch (error: any) {
      console.error("Error during upload/finalization:", error);
      toast({
        title: "Error de Subida",
        description: error.message || "No se pudo completar el proceso de subida del video.",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    } finally {
      setIsUploading(false);
    }
    
    // 4. Analyze video from Public URL
    setIsAnalyzing(true);
    toast({ title: "Comenzando análisis...", description: "La IA está procesando el video. Esto puede tomar varios minutos." });

    try {
        const result = await analyzeVideoContent({ 
          publicUrl,
          contentType: videoFile.type,
        });
        setAnalysisResult({clips: result.clips, speakers: result.speakers});
        toast({ title: "Análisis completo!", description: `Se encontraron ${result.clips.length} clips potenciales.`});
    } catch (error: any) {
        console.error("Error analyzing video:", error);
        toast({
          title: "Error de Análisis",
          description: error.message || "No se pudo analizar el video.",
          variant: "destructive",
        });
    } finally {
        setIsAnalyzing(false);
    }
  }
  
  const isLoading = isUploading || isAnalyzing;
  const loadingStep = isUploading ? "Subiendo..." : "Analizando...";

  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-6 w-6" />
          Video Clipper
        </CardTitle>
        <CardDescription>
          Sube un video, la IA lo analizará para crear clips verticales inteligentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2">
          <Input type="file" accept="video/*" onChange={handleFileChange} disabled={isLoading} />
          <Button onClick={handleAnalyze} className="w-full" disabled={!videoFile || isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Bot className="mr-2" />}
              {isLoading ? loadingStep : "Analizar Video y Buscar Clips"}
          </Button>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {isLoading && (
             <div className="text-center text-muted-foreground py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>
                    {loadingStep}
                </p>
                <p className="text-sm">Esto puede tardar varios minutos para videos largos.</p>
              </div>
          )}

          {analysisResult && analysisResult.clips.length > 0 ? (
            analysisResult.clips.map((clip) => {
              const speaker = analysisResult.speakers.find(s => s.id === clip.mainSpeakerId);
              return (
                <Card key={clip.id} className="bg-card/50">
                  <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                          <p className="font-semibold text-card-foreground break-words w-full">
                              {clip.title}
                          </p>
                           <Badge variant="secondary" className="flex-shrink-0">
                             <Clock className="h-3 w-3 mr-1" />
                             {formatTimestamp(clip.startTime)} - {formatTimestamp(clip.endTime)}
                           </Badge>
                      </div>
                    <p className="text-sm text-muted-foreground break-words w-full">
                      {clip.summary}
                    </p>
                    {speaker && (
                      <Badge variant="outline">
                        <User className="h-3 w-3 mr-1.5" />
                        Enfocar en: {speaker.description}
                      </Badge>
                    )}
                    <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="w-full" disabled>
                          <Scissors className="mr-2 h-4 w-4"/>
                          Crear Clip con FFMPEG (Próximamente)
                        </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            !isLoading && (
                <div className="text-center text-muted-foreground py-12">
                    <p>Sube un video para comenzar.</p>
                </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
