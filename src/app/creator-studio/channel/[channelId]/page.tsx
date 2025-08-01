
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getYoutubeStats, type GetYoutubeStatsOutput } from '@/ai/flows/get-youtube-stats';
import { getYoutubeVideos, type GetYoutubeVideosOutput } from '@/ai/flows/get-youtube-videos';
import { ArrowLeft, Loader2, AlertTriangle, Youtube, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';


type ChannelPageProps = {
  params: {
    channelId: string;
  };
};

export default function ChannelPage({ params }: ChannelPageProps) {
  const { channelId } = params;
  const [stats, setStats] = useState<GetYoutubeStatsOutput | null>(null);
  const [videos, setVideos] = useState<GetYoutubeVideosOutput['videos'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!channelId) return;

    const fetchChannelData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetching with channelId requires a different approach than handle
        // For simplicity, we'll re-use getYoutubeVideos and fetch stats from videos if needed
        // A dedicated `getChannelById` flow would be ideal.
        // As a workaround, we'll rely on the getYoutubeVideos and get the stats from the first video if available
        
        const videoData = await getYoutubeVideos({ channelId: channelId, maxResults: 50 });
        setVideos(videoData.videos);

        // Since we don't have a direct `getStatsById` flow, we'll get it from `getYoutubeStats`
        // by handle. This is inefficient. A proper implementation would have a getChannelById flow.
        // For now, we will just show videos.
        
        // This is a placeholder for stats. In a real app you would fetch this by ID.
        if (videoData.videos && videoData.videos.length > 0) {
            // We don't have the handle, so we can't fetch stats easily.
            // We'll just display a generic title.
        }

      } catch (err: any) {
        console.error(`Failed to fetch data for channel ${channelId}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, [channelId]);

  const handleCopyLink = (videoId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedVideoId(videoId);
      toast({ title: '¡Enlace copiado!', description: 'El enlace ha sido copiado al portapapeles.' });
      setTimeout(() => setCopiedVideoId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      toast({ title: 'Error', description: 'No se pudo copiar el enlace.', variant: 'destructive' });
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold font-headline">Videos del Canal</h1>
          <Button asChild variant="outline">
            <Link href="/creator-studio">
              <ArrowLeft className="mr-2" />
              Volver a Creator Studio
            </Link>
          </Button>
        </div>

        {loading ? (
            <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
                <p className="mt-4 text-lg">Cargando videos...</p>
            </div>
        ) : error ? (
            <div className="flex items-center justify-center gap-2 text-destructive bg-destructive/10 p-4 rounded-md">
                <AlertTriangle />
                <p>Error al cargar el canal: {error}</p>
            </div>
        ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {videos.map((video) => (
                    <Link key={video.id} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="block group h-full">
                        <Card className="h-full flex flex-col hover:bg-accent transition-colors">
                            <div className="relative">
                            <Image
                                src={video.thumbnailUrl}
                                alt={`Miniatura de ${video.title}`}
                                width={1920}
                                height={1080}
                                className="aspect-video object-cover w-full rounded-t-lg"
                            />
                            {video.duration && (
                                <Badge variant="secondary" className="absolute bottom-2 right-2 bg-black/70 text-white">
                                    {video.duration}
                                </Badge>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8 bg-black/50 hover:bg-black/75 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleCopyLink(video.id, e)}
                            >
                                {copiedVideoId === video.id ? <Check className="text-green-500" /> : <Copy />}
                                <span className="sr-only">Copiar enlace</span>
                            </Button>
                            </div>
                            <CardContent className="p-3 flex-grow">
                            <p className="font-semibold text-sm line-clamp-2" title={video.title}>
                                {video.title}
                            </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        ) : (
            <p className="text-muted-foreground text-center py-16">
              No se encontraron videos para este canal.
            </p>
        )}
      </main>
    </div>
  );
}
