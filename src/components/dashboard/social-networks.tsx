"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Globe, AlertTriangle, Loader } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { YoutubeIcon } from "../icons/youtube-icon";
import { getYoutubeStats, type GetYoutubeStatsOutput } from "@/ai/flows/get-youtube-stats";

type SocialAccount = {
  platform: "YouTube";
  handle: string;
  href: string;
  icon: JSX.Element;
};

const socialAccounts: SocialAccount[] = [
  {
    platform: "YouTube",
    handle: "@transdavismo",
    href: "https://www.youtube.com/@transdavismo",
    icon: <YoutubeIcon className="h-6 w-6" />,
  },
  // Add more accounts here in the future
];

export default function SocialNetworks({ className }: { className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState<GetYoutubeStatsOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      setStats(null);

      try {
        const apiKey = localStorage.getItem("youtube_api_key");
        if (!apiKey) {
          throw new Error("YouTube API key not found. Please add it in the API Key Manager with the service name 'youtube_api_key'.");
        }
        const account = socialAccounts[currentIndex];
        const result = await getYoutubeStats({
          channelHandle: account.handle,
          apiKey: apiKey,
        });
        setStats(result);
      } catch (e: any) {
        setError(e.message || "Failed to fetch YouTube stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % socialAccounts.length);
  };

  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + socialAccounts.length) % socialAccounts.length
    );
  };

  const account = socialAccounts[currentIndex];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Loader className="h-8 w-8 animate-spin" />
          <p className="mt-2">Loading channel data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive text-center">
          <AlertTriangle className="h-8 w-8" />
          <p className="mt-2 font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (stats) {
      return (
        <>
          <div className="flex items-center justify-between w-full mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              disabled={socialAccounts.length <= 1}
              aria-label="Previous Account"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="flex flex-col items-center gap-2">
              <Image
                src={stats.profilePicUrl}
                alt={`${stats.name} profile picture`}
                width={80}
                height={80}
                className="rounded-full border-2 border-primary"
              />
              <div className="flex items-center gap-2">
                {account.icon}
                <h3 className="text-xl font-bold">{stats.name}</h3>
              </div>
              <p className="text-muted-foreground">{account.handle}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={socialAccounts.length <= 1}
              aria-label="Next Account"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex justify-around w-full my-4">
            <div key="Subscribers">
              <p className="text-2xl font-bold">{stats.subscriberCount}</p>
              <p className="text-sm text-muted-foreground">Subscribers</p>
            </div>
             <div key="Videos">
              <p className="text-2xl font-bold">{stats.videoCount}</p>
              <p className="text-sm text-muted-foreground">Videos</p>
            </div>
          </div>
          <Button asChild className="w-full mt-auto">
            <Link href={account.href} target="_blank" rel="noopener noreferrer">
              Visit Channel
            </Link>
          </Button>
        </>
      );
    }
    return null;
  };

  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-6 w-6" />
          Social Networks
        </CardTitle>
        <CardDescription>
          Connect and stay updated across your networks.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center items-center text-center">
        {renderContent()}
      </CardContent>
    </Card>
  );
}
