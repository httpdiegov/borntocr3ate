"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { YoutubeIcon } from "../icons/youtube-icon";

const socialAccounts = [
  {
    platform: "YouTube",
    name: "Transdavismo",
    handle: "@transdavismo",
    href: "https://www.youtube.com/@transdavismo",
    icon: <YoutubeIcon className="h-6 w-6" />,
    profilePic: "https://placehold.co/80x80.png",
    stats: [
      { label: "Subscribers", value: "1.23K" },
      { label: "Videos", value: "45" },
    ],
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
          <div className="flex flex-col items-center gap-2">
            <Image
              src={account.profilePic}
              alt={`${account.name} profile picture`}
              width={80}
              height={80}
              className="rounded-full border-2 border-primary"
              data-ai-hint="youtube logo"
            />
            <div className="flex items-center gap-2">
               {account.icon}
               <h3 className="text-xl font-bold">{account.name}</h3>
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
          {account.stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
        <Button asChild className="w-full mt-auto">
          <Link href={account.href} target="_blank" rel="noopener noreferrer">
            Visit Channel
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
