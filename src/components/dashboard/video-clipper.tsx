
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
import { generateUploadUrl } from "@/ai/flows/generate-upload-url";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";

const sanitizeFilename = (filename: string): string => {
  // Replace spaces and special characters with underscores, remove others except dot
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};


export default function VideoClipper({ className }: { className?: string }) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
  
  const handleTranscribe = async () => {
    if (!videoFile) return;

    // Reset state
    setTranscription(null);
    setClips([]);

    // 1. Get signed URL for upload
    setIsUploading(true);
    toast({ title: "Preparing secure upload...", description: "This is the recommended way for large files." });
    let gcsUri: string;
    
    const safeFilename = sanitizeFilename(videoFile.name);

    try {
      const { signedUrl, gcsUri: resultGcsUri } = await generateUploadUrl({
        filename: safeFilename,
        contentType: videoFile.type,
      });
      gcsUri = resultGcsUri;

      // 2. Upload file directly to GCS
      toast({ title: "Uploading video...", description: "Your file is being uploaded directly to secure storage." });
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: videoFile,
        headers: {
          'Content-Type': videoFile.type,
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Upload failed with status:", uploadResponse.status, "and message:", errorText);
        throw new Error(`Upload failed. Server responded with: ${errorText}`);
      }
      toast({ title: "Upload complete!", description: "Video is now securely stored." });
    } catch (error: any) {
        console.error("Error during upload process:", error);
        toast({
          title: "Upload Error",
          description: error.message || "Could not prepare or complete the video upload.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
    } finally {
      setIsUploading(false);
    }
    
    // 3. Transcribe from GCS URI
    setIsTranscribing(true);
    toast({ title: "Starting transcription...", description: "The AI is processing the video. This may take a few minutes." });

    try {
        const result = await transcribeVideo({ 
          gcsUri,
          contentType: videoFile.type,
        });
        setTranscription(result.transcription);
        toast({ title: "Transcription complete!", description: "You can now analyze the text to find clips."});
    } catch (error: any) {
        console.error("Error transcribing video:", error);
        toast({
          title: "Transcription Error",
          description: error.message || "Could not transcribe the video. Check the console for details.",
          variant: "destructive",
        });
    } finally {
        setIsTranscribing(false);
    }
  }

  const handleAnalyze = async () => {
    if (!transcription) {
      toast({
        title: "No transcription available",
        description: "Please transcribe the video first.",
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
        title: "Analysis complete",
        description: `Identified ${result.clips.length} potential clips.`,
      });

    } catch (error: any) {
      console.error("Error analyzing video:", error);
      toast({
        title: "Analysis Error",
        description: error.message || "Could not generate clips.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const isLoading = isUploading || isTranscribing || isAnalyzing;
  const loadingStep = isUploading ? "Uploading..." : isTranscribing ? "Transcribing..." : "Analyzing...";

  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-6 w-6" />
          Video Clipper
        </CardTitle>
        <CardDescription>
          Upload a video, the AI will transcribe it and find key moments to create clips.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2">
          <Input type="file" accept="video/*" onChange={handleFileChange} disabled={isLoading} />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleTranscribe} className="w-full" disabled={!videoFile || isLoading}>
                {isUploading || isTranscribing ? <Loader2 className="animate-spin mr-2" /> : <WholeWord className="mr-2" />}
                {isUploading ? "Uploading..." : isTranscribing ? "Transcribing..." : "1. Process Video"}
            </Button>
            <Button onClick={handleAnalyze} className="w-full" disabled={!transcription || isLoading}>
                {isAnalyzing ? <Loader2 className="animate-spin mr-2" /> : <Bot className="mr-2" />}
                {isAnalyzing ? "Analyzing..." : "2. Find Clips"}
            </Button>
          </div>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {isLoading && (
             <div className="text-center text-muted-foreground py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>
                    {loadingStep}
                </p>
                <p className="text-sm">This may take a few minutes for large videos.</p>
              </div>
          )}

          {transcription && !isTranscribing && (
            <div>
              <h3 className="font-semibold mb-2">Video Transcription:</h3>
              <Textarea 
                readOnly 
                value={transcription} 
                className="h-32 bg-muted/50"
                placeholder="The transcription will appear here..."
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
                        Create Clip (Coming Soon)
                      </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            !isLoading && !transcription && (
                <div className="text-center text-muted-foreground py-12">
                    <p>Upload a video to get started.</p>
                </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
