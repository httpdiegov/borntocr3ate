'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getYoutubeStats, type GetYoutubeStatsOutput } from '@/ai/flows/get-youtube-stats';
import { getYoutubeVideos, type GetYoutubeVideosOutput } from '@/ai/flows/get-youtube-videos';
import { ArrowLeft, Loader2, AlertTriangle, Youtube } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

const channelHandles = ['@CobrismoOOC', '@LaCobraaKick', '@DavooXeneizeTwitch', '@412-DomadasyBurradas', '@Puerroclips1234', '@lacobraxtra'];

type ChannelData = {
  stats: GetYoutubeStatsOutput | null;
  videos: GetYoutubeVideosOutput['videos'] | null;
  loading: boolean;
  error: string | null;
};

export default function CreatorStudioPage() {
  const [channels, setChannels] = useState<Record<string, ChannelData>>(
    Object.fromEntries(
      channelHandles.map((handle) => [
        handle,
        { stats: null, videos: null, loading: true, error: null },
      ])
    )
  );

  useEffect(() => {
    const fetchAllChannelData = async () => {
      for (const handle of channelHandles) {
        try {
          // Fetch stats
          const stats = await getYoutubeStats({ channelHandle: handle });
          setChannels((prev) => ({
            ...prev,
            [handle]: { ...prev[handle], stats },
          }));

          // Fetch videos using the channel ID from stats
          if (stats.id) {
            const videoData = await getYoutubeVideos({ channelId: stats.id, maxResults: 6 });
            setChannels((prev) => ({
              ...prev,
              [handle]: { ...prev[handle], videos: videoData.videos, loading: false },
            }));
          } else {
            throw new Error('Channel ID not found.');
          }
        } catch (err: any) {
          console.error(`Failed to fetch data for ${handle}:`, err);
          setChannels((prev) => ({
            ...prev,
            [handle]: { ...prev[handle], error: err.message, loading: false },
          }));
        }
      }
    };
    fetchAllChannelData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold font-headline">Creator Studio</h1>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>

        <div className="grid gap-8">
          {channelHandles.map((handle) => {
            const { stats, videos, loading, error } = channels[handle];

            return (
              <Card key={handle} className="overflow-hidden">
                <CardHeader>
                  {loading ? (
                    <div className="flex items-center gap-4">
                      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                       <div>
                         <div className="h-6 w-48 bg-muted-foreground/20 rounded-md animate-pulse" />
                         <div className="h-4 w-32 bg-muted-foreground/20 rounded-md animate-pulse mt-2" />
                       </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle />
                      <p>Error al cargar el canal: {handle}</p>
                    </div>
                  ) : stats ? (
                    <div className="flex items-center gap-4">
                      <Image
                        src={stats.profilePicUrl}
                        alt={`Foto de perfil de ${stats.name}`}
                        width={64}
                        height={64}
                        className="rounded-full border-2 border-primary"
                      />
                      <div>
                        <CardTitle className="text-2xl flex items-center gap-2">
                           <Youtube className="text-red-600"/> {stats.name}
                        </CardTitle>
                        <p className="text-muted-foreground">{handle}</p>
                      </div>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {loading ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[...Array(6)].map((_, i) => (
                           <div key={i} className="space-y-2">
                              <div className="aspect-video w-full bg-muted-foreground/20 rounded-md animate-pulse"/>
                              <div className="h-4 w-full bg-muted-foreground/20 rounded-md animate-pulse"/>
                              <div className="h-4 w-3/4 bg-muted-foreground/20 rounded-md animate-pulse"/>
                           </div>
                        ))}
                     </div>
                  ) : error ? (
                    <p className="text-destructive-foreground text-center bg-destructive/50 p-4 rounded-md">
                      {error}
                    </p>
                  ) : videos && videos.length > 0 ? (
                    <div>
                      <h3 className="text-xl font-semibold mb-4">Últimos Videos</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {videos.map((video) => (
                          <Link href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" key={video.id}>
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
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No se encontraron videos para este canal.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
