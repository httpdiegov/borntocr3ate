

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
import { Film, Bot, Loader2, Scissors, User, Clock, Wand, Settings, CheckCircle, AlertTriangle, FileJson, Video } from "lucide-react";
import { analyzeVideoContent, type AnalyzedClip, type Speaker, type TranscriptionSegment } from "@/ai/flows/analyze-video-content";
import { generateUploadUrl, type GenerateUploadUrlOutput } from "@/ai/flows/generate-upload-url";
import { finalizeUpload } from "@/ai/flows/finalize-upload";
import { addSubtitlesToVideo } from "@/ai/flows/add-subtitles-to-video";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "../ui/label";

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
  fullTranscription: TranscriptionSegment[];
  videoInfo: GenerateUploadUrlOutput;
};

type ClipProcessingState = {
  [clipId: string]: {
    isLoading: boolean;
    resultPath?: string;
    ffmpegCommand?: string;
  };
};

function SmartClipperTab() {
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
        toast({ title: "Invalid file type", description: "Please select a video file.", variant: "destructive" });
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
      videoInfo = await generateUploadUrl({ filename: safeFilename, contentType: videoFile.type });
      toast({ title: "Subiendo video...", description: "Tu archivo se está subiendo directamente al almacenamiento seguro." });
      const uploadResponse = await fetch(videoInfo.signedUrl, { method: 'PUT', body: videoFile, headers: { 'Content-Type': videoFile.type } });
      if (!uploadResponse.ok) throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      toast({ title: "Subida completa! Finalizando..." });
      const finalizeResult = await finalizeUpload({ gcsUri: videoInfo.gcsUri });
      if (!finalizeResult.success) throw new Error(finalizeResult.message);
      setIsUploading(false);
      setIsAnalyzing(true);
      toast({ title: "Comenzando análisis...", description: "La IA está procesando el video. Esto puede tomar varios minutos." });
      const result = await analyzeVideoContent({ publicUrl: videoInfo.publicUrl, contentType: videoFile.type });
      setAnalysisResult({ ...result, videoInfo });
      toast({ title: "Análisis completo!", description: `Se encontraron ${result.clips.length} clips potenciales.` });
    } catch (error: any) {
      console.error("Error during video processing:", error);
      toast({ title: "Error en el Proceso", description: error.message || "No se pudo completar el proceso del video.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const isLoading = isUploading || isAnalyzing;
  const loadingStep = isUploading ? "Subiendo..." : "Analizando...";

  return (
    <div className="space-y-4">
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
                  <p className="text-sm text-muted-foreground break-words w-full">{clip.transcription}</p>
                  {speaker && <Badge variant="outline"><User className="h-3 w-3 mr-1.5" />Orador Principal: {speaker.description}</Badge>}
                </CardContent>
              </Card>
            )
          })
        ) : (
          !isLoading && (
            <div className="text-center text-muted-foreground py-12">
              <p>Sube un video largo para que la IA encuentre los mejores clips.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SubtitlerTab() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ path: string } | null>(null);
  const { toast } = useToast();

  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setResult(null);
    } else {
      setVideoFile(null);
      toast({ title: "Tipo de archivo inválido", description: "Por favor, selecciona un archivo de video MP4.", variant: "destructive" });
    }
  };
  
  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/json") {
      setJsonFile(file);
      setResult(null);
    } else {
      setJsonFile(null);
      toast({ title: "Tipo de archivo inválido", description: "Por favor, selecciona un archivo JSON.", variant: "destructive" });
    }
  };

  const handleAddSubtitles = async () => {
    if (!videoFile || !jsonFile) return;
    setResult(null);
    setIsLoading(true);

    try {
        toast({ title: "Preparando subida de archivos..." });

        const videoFilename = sanitizeFilename(videoFile.name);

        // Subir video
        const videoUploadInfo = await generateUploadUrl({ filename: videoFilename, contentType: videoFile.type });
        await fetch(videoUploadInfo.signedUrl, { method: 'PUT', body: videoFile, headers: { 'Content-Type': videoFile.type }});
        await finalizeUpload({ gcsUri: videoUploadInfo.gcsUri });
        const videoUrl = videoUploadInfo.publicUrl;
        
        toast({ title: "Leyendo archivo de transcripción..."});

        // Leer el archivo JSON en el navegador
        const transcriptionData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result;
                    if (typeof text === 'string') {
                        resolve(JSON.parse(text));
                    } else {
                        reject(new Error("No se pudo leer el archivo JSON."));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (e) => reject(new Error("Error al leer el archivo."));
            reader.readAsText(jsonFile);
        });
        
        toast({ title: "Archivos listos. Renderizando subtítulos...", description: "Esto puede tardar varios minutos."});

        const result = await addSubtitlesToVideo({
            videoUrl: videoUrl,
            transcription: transcriptionData,
            outputFilename: `subtitled_${videoFilename}`
        });

      if (result.success && result.outputPath) {
        setResult({ path: result.outputPath });
        toast({ title: "¡Video con subtítulos creado!", description: `El video se ha guardado en la carpeta 'videos' de tu proyecto.` });
      } else {
        throw new Error(result.message || "No se pudo generar el video con subtítulos.");
      }
    } catch (error: any) {
      console.error("Error adding subtitles:", error);
      toast({ title: "Error al añadir subtítulos", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="video-upload" className="flex items-center gap-2"><Video className="h-4 w-4"/> 1. Sube tu video vertical (MP4)</Label>
            <Input id="video-upload" type="file" accept="video/mp4" onChange={handleVideoFileChange} disabled={isLoading} />
        </div>
         <div className="space-y-2">
            <Label htmlFor="json-upload" className="flex items-center gap-2"><FileJson className="h-4 w-4"/> 2. Sube el JSON de transcripción</Label>
            <Input id="json-upload" type="file" accept="application/json" onChange={handleJsonFileChange} disabled={isLoading} />
        </div>

      <Button onClick={handleAddSubtitles} className="w-full" disabled={!videoFile || !jsonFile || isLoading}>
        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Wand className="mr-2" />}
        {isLoading ? "Renderizando Video..." : "Añadir Subtítulos con Remotion"}
      </Button>

      {isLoading && (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Renderizando... Esto puede tardar.</p>
          </div>
      )}

      {result && (
        <div className="pt-2 space-y-2">
            <Card className="mt-2 text-center bg-green-950/50 border-green-500/20">
                <CardContent className="p-3">
                    <p className="text-sm text-green-300">¡Video guardado!</p>
                    <p className="text-xs text-muted-foreground">{`Lo encontrarás en: ${result.path}`}</p>
                </CardContent>
            </Card>
        </div>
      )}
       {!result && !isLoading && (
            <div className="text-center text-muted-foreground py-12">
              <p>Sube tu video y JSON para empezar.</p>
            </div>
          )
        }
    </div>
  );
}


export default function VideoClipper({ className }: { className?: string }) {
  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-6 w-6" />
          Video Tools
        </CardTitle>
        <CardDescription>
          Herramientas de IA para analizar y transformar tus videos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <Tabs defaultValue="subtitler" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
             <TabsTrigger value="subtitler">
                <Wand className="mr-2"/> Subtitler AI
            </TabsTrigger>
            <TabsTrigger value="smart-clipper">
                <Scissors className="mr-2"/> Smart Clipper
            </TabsTrigger>
          </TabsList>
          <TabsContent value="subtitler" className="mt-4">
            <SubtitlerTab />
          </TabsContent>
          <TabsContent value="smart-clipper" className="mt-4">
            <SmartClipperTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
