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
import { InstagramIcon } from "../icons/instagram-icon";
import { getYoutubeStats, type GetYoutubeStatsOutput } from "@/ai/flows/get-youtube-stats";
import { getInstagramBusinessStats, type GetInstagramBusinessStatsOutput } from "@/ai/flows/get-instagram-business-stats";

type SocialAccount = {
  platform: "YouTube" | "Instagram";
  handle: string;
  href: string;
  icon: JSX.Element;
  statsComponent: React.FC<{ handle: string; businessIdKey?: string }>;
  businessIdKey?: string;
};

type ApiKey = {
  id: string;
  service: string;
  key: string;
};

// Function to format large numbers
const formatNumber = (num: number): string => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};


const YouTubeStats: React.FC<{ handle: string }> = ({ handle }) => {
  const [stats, setStats] = useState<GetYoutubeStatsOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      setStats(null);

      try {
        let apiKey: string | undefined;
        const storedKeys = localStorage.getItem("apiKeys");
        if (storedKeys) {
          const keys: ApiKey[] = JSON.parse(storedKeys);
          apiKey = keys.find(k => k.service === 'youtube_api_key')?.key;
        }
        
        if (!apiKey) {
          throw new Error("YouTube API key not found. Please add it in the API Key Manager with the service name 'youtube_api_key'.");
        }
        
        const result = await getYoutubeStats({
          channelHandle: handle,
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
  }, [handle, isMounted]);

  if (!isMounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Loader className="h-8 w-8 animate-spin" />
        <p className="mt-2">Loading channel data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive text-center p-4">
        <AlertTriangle className="h-8 w-8" />
        <p className="mt-2 font-semibold">Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  
  if (stats) {
    return (
      <div className="flex flex-col items-center w-full">
        <Image
          src={stats.profilePicUrl}
          alt={`${stats.name} profile picture`}
          width={80}
          height={80}
          className="rounded-full border-2 border-primary"
        />
        <div className="flex items-center gap-2 mt-2">
          <YoutubeIcon className="h-6 w-6" />
          <h3 className="text-xl font-bold">{stats.name}</h3>
        </div>
        <p className="text-muted-foreground">{handle}</p>
        <div className="grid grid-cols-3 justify-around w-full my-4 text-center">
            <div key="Subscribers">
              <p className="text-2xl font-bold">{stats.subscriberCount}</p>
              <p className="text-sm text-muted-foreground">Subscribers</p>
            </div>
             <div key="Videos">
              <p className="text-2xl font-bold">{stats.videoCount}</p>
              <p className="text-sm text-muted-foreground">Videos</p>
            </div>
             <div key="Views">
              <p className="text-2xl font-bold">{stats.viewCount}</p>
              <p className="text-sm text-muted-foreground">Views</p>
            </div>
        </div>
      </div>
    )
  }

  return null;
}

const InstagramStats: React.FC<{ handle: string, businessIdKey?: string }> = ({ handle, businessIdKey = 'instagram_business_account_id' }) => {
    const [stats, setStats] = useState<GetInstagramBusinessStatsOutput | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const fetchStats = async () => {
            setLoading(true);
            setError(null);
            setStats(null);
            try {
                let accessToken: string | undefined;
                let businessAccountId: string | undefined;
                const storedKeys = localStorage.getItem("apiKeys");
                if (storedKeys) {
                    const keys: ApiKey[] = JSON.parse(storedKeys);
                    accessToken = keys.find(k => k.service === 'instagram_access_token')?.key;
                    businessAccountId = keys.find(k => k.service === businessIdKey)?.key;
                }

                if (!accessToken) {
                    throw new Error("Instagram Access Token not found. Please add it in the API Key Manager with the service name 'instagram_access_token'.");
                }
                if (!businessAccountId) {
                    throw new Error(`Instagram Business Account ID key '${businessIdKey}' not found. Please add it in the API Key Manager.`);
                }
                
                const result = await getInstagramBusinessStats({
                    usernameToQuery: handle.startsWith('@') ? handle.substring(1) : handle,
                    instagramBusinessAccountId: businessAccountId,
                    accessToken: accessToken,
                });
                setStats(result);
            } catch (e: any) {
                setError(e.message || "Failed to fetch Instagram stats.");
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [handle, isMounted, businessIdKey]);

    if (!isMounted || loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader className="h-8 w-8 animate-spin" />
                <p className="mt-2">Loading account data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-destructive text-center p-4">
                <AlertTriangle className="h-8 w-8" />
                <p className="mt-2 font-semibold">Error</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (stats) {
        return (
            <div className="flex flex-col items-center w-full">
                <Image
                  src={stats.profilePicUrl || 'https://placehold.co/80x80.png'}
                  data-ai-hint="logo"
                  alt={`${stats.username} profile picture`}
                  width={80}
                  height={80}
                  className="rounded-full border-2 border-primary"
                />
                <div className="flex items-center gap-2 mt-2">
                    <InstagramIcon className="h-6 w-6" />
                    <h3 className="text-xl font-bold">{stats.username}</h3>
                </div>
                <p className="text-muted-foreground">@{stats.username}</p>
                <div className="grid grid-cols-2 justify-around w-full my-4 text-center">
                    <div key="Followers">
                        <p className="text-2xl font-bold">{formatNumber(stats.followersCount)}</p>
                        <p className="text-sm text-muted-foreground">Followers</p>
                    </div>
                    <div key="Posts">
                        <p className="text-2xl font-bold">{formatNumber(stats.mediaCount)}</p>
                        <p className="text-sm text-muted-foreground">Posts</p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}


const socialAccounts: SocialAccount[] = [
  {
    platform: "YouTube",
    handle: "@transdavismo",
    href: "https://www.youtube.com/@transdavismo",
    icon: <YoutubeIcon className="h-6 w-6" />,
    statsComponent: YouTubeStats,
  },
  {
    platform: "Instagram",
    handle: "ilovesanrio666",
    href: "https://www.instagram.com/ilovesanrio666",
    icon: <InstagramIcon className="h-6 w-6" />,
    statsComponent: InstagramStats,
    businessIdKey: "instagram_business_account_id",
  },
  {
    platform: "Instagram",
    handle: "google",
    href: "https://www.instagram.com/google",
    icon: <InstagramIcon className="h-6 w-6" />,
    statsComponent: InstagramStats,
    businessIdKey: "instagram_business_account_id",
  },
  {
    platform: "Instagram",
    handle: "truegarments_",
    href: "https://www.instagram.com/truegarments_",
    icon: <InstagramIcon className="h-6 w-6" />,
    statsComponent: InstagramStats,
    businessIdKey: "instagram_business_account_id",
  },
];

export default function SocialNetworks({ className }: { className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % socialAccounts.length);
  };

  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + socialAccounts.length) % socialAccounts.length
    );
  };

  const account = socialAccounts[currentIndex];
  const StatsComponent = account.statsComponent;

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
            
            <div className="flex-grow flex flex-col items-center">
                <StatsComponent handle={account.handle} businessIdKey={account.businessIdKey} />
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
          <Button asChild className="w-full mt-auto">
            <Link href={account.href} target="_blank" rel="noopener noreferrer">
              Visit {account.platform}
            </Link>
          </Button>
      </CardContent>
    </Card>
  );
}
