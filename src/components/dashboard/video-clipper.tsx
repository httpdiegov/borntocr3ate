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
import { Film, Bot, Loader2, Scissors, User, Clock, Wand, Download } from "lucide-react";
import { analyzeVideoContent, type AnalyzedClip, type Speaker } from "@/ai/flows/analyze-video-content";
import { generateUploadUrl, type GenerateUploadUrlOutput } from "@/ai/flows/generate-upload-url";
import { finalizeUpload } from "@/ai/flows/finalize-upload";
import { createVideoClip } from "@/ai/flows/create-video-clip";
import { Badge } from "../ui/badge";

const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const formatTimestamp = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

type AnalysisState = {
  clips: AnalyzedClip[];
  speakers: Speaker[];
  videoInfo: GenerateUploadUrlOutput;
};

type ClipProcessingState = {
  [clipId: string]: {
    isLoading: boolean;
    resultUrl?: string;
    ffmpegCommand?: string;
  };
};

export default function VideoClipper({ className }: { className?: string }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisState | null>(null);
  const [clipProcessingState, setClipProcessingState] = useState<ClipProcessingState>({});

  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setVideoFile(file);
        setAnalysisResult(null);
        setClipProcessingState({});
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
    setClipProcessingState({});
    setIsUploading(true);
    let videoInfo: GenerateUploadUrlOutput;
    const safeFilename = sanitizeFilename(videoFile.name);

    try {
      toast({ title: "Preparando subida segura..." });
      videoInfo = await generateUploadUrl({
        filename: safeFilename,
        contentType: videoFile.type,
      });

      toast({ title: "Subiendo video...", description: "Tu archivo se está subiendo directamente al almacenamiento seguro." });
      const uploadResponse = await fetch(videoInfo.signedUrl, {
        method: 'PUT',
        body: videoFile,
        headers: { 'Content-Type': videoFile.type },
      });
      if (!uploadResponse.ok) throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      
      toast({ title: "Subida completa! Finalizando..." });
      const finalizeResult = await finalizeUpload({ gcsUri: videoInfo.gcsUri });
      if (!finalizeResult.success) throw new Error(finalizeResult.message);
      
      setIsUploading(false);

      setIsAnalyzing(true);
      toast({ title: "Comenzando análisis...", description: "La IA está procesando el video. Esto puede tomar varios minutos." });
      const result = await analyzeVideoContent({
        publicUrl: videoInfo.publicUrl,
        contentType: videoFile.type,
      });

      setAnalysisResult({ clips: result.clips, speakers: result.speakers, videoInfo });
      toast({ title: "Análisis completo!", description: `Se encontraron ${result.clips.length} clips potenciales.` });

    } catch (error: any) {
      console.error("Error during video processing:", error);
      toast({
        title: "Error en el Proceso",
        description: error.message || "No se pudo completar el proceso del video.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const handleCreateClip = async (clip: AnalyzedClip) => {
    if (!analysisResult) return;

    const speaker = analysisResult.speakers.find(s => s.id === clip.mainSpeakerId);
    if (!speaker) {
        toast({ title: "Error", description: "Speaker not found for this clip.", variant: "destructive" });
        return;
    }

    setClipProcessingState(prev => ({ ...prev, [clip.id]: { isLoading: true } }));
    toast({ title: "Creando clip...", description: "Esto puede tardar un momento. Requiere ffmpeg instalado localmente." });

    try {
        const result = await createVideoClip({
            videoUrl: analysisResult.videoInfo.publicUrl,
            startTime: clip.startTime,
            endTime: clip.endTime,
            speaker: speaker,
            clipTitle: clip.title
        });

        if (result.success && result.videoDataUri) {
            setClipProcessingState(prev => ({
                ...prev,
                [clip.id]: { isLoading: false, resultUrl: result.videoDataUri, ffmpegCommand: result.ffmpegCommand }
            }));
            toast({ title: "¡Clip Creado!", description: "El clip está listo para descargar." });
        } else {
            throw new Error(result.message);
        }

    } catch (error: any) {
      console.error("Error creating clip:", error);
      toast({
        title: "Error al Crear Clip",
        description: error.message || "No se pudo generar el clip.",
        variant: "destructive",
      });
      setClipProcessingState(prev => ({ ...prev, [clip.id]: { isLoading: false } }));
    }
  };

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
            {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Wand className="mr-2" />}
            {isLoading ? loadingStep : "Analizar y Buscar Clips"}
          </Button>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {isLoading && (
             <div className="text-center text-muted-foreground py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>{loadingStep}</p>
                <p className="text-sm">Esto puede tardar varios minutos para videos largos.</p>
              </div>
          )}

          {analysisResult && analysisResult.clips.length > 0 ? (
            analysisResult.clips.map((clip) => {
              const speaker = analysisResult.speakers.find(s => s.id === clip.mainSpeakerId);
              const clipState = clipProcessingState[clip.id] || { isLoading: false };

              return (
                <Card key={clip.id} className="bg-card/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-semibold text-card-foreground break-words w-full">{clip.title}</p>
                      <Badge variant="secondary" className="flex-shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimestamp(clip.startTime)} - {formatTimestamp(clip.endTime)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground break-words w-full">{clip.summary}</p>
                    {speaker && (
                      <Badge variant="outline">
                        <User className="h-3 w-3 mr-1.5" />
                        Enfocar en: {speaker.description} ({speaker.position})
                      </Badge>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="w-full" disabled={clipState.isLoading} onClick={() => handleCreateClip(clip)}>
                        {clipState.isLoading ? <Loader2 className="animate-spin mr-2" /> : <Scissors className="mr-2 h-4 w-4" />}
                        {clipState.isLoading ? "Procesando..." : "Crear Clip con FFMPEG"}
                      </Button>
                    </div>
                    {clipState.resultUrl && (
                      <div className="pt-2 space-y-2">
                         <video controls src={clipState.resultUrl} className="w-full rounded-md" />
                         <Button size="sm" asChild className="w-full">
                           <a href={clipState.resultUrl} download={`${clip.title}.mp4`}>
                             <Download className="mr-2 h-4 w-4" />
                             Descargar Clip
                           </a>
                         </Button>
                      </div>
                    )}
                    {clipState.ffmpegCommand && (
                        <Card className="mt-2">
                            <CardHeader className="p-2">
                                <CardTitle className="text-sm">Comando FFMPEG Generado</CardTitle>
                            </CardHeader>
                            <CardContent className="p-2">
                                <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                                    <code>{clipState.ffmpegCommand}</code>
                                </pre>
                            </CardContent>
                        </Card>
                    )}
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
