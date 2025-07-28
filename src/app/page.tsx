import ApiKeyManager from "@/components/dashboard/api-key-manager";
import CreatorStudio from "@/components/dashboard/creator-studio";
import Ideari from "@/components/dashboard/ideari";
import NewsBrief from "@/components/dashboard/news-brief";
import SocialNetworks from "@/components/dashboard/social-networks";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold font-headline text-foreground">
            Vision Board
          </h1>
        </div>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          <div className="xl:col-span-1 grid gap-6">
            <NewsBrief />
            <Ideari />
          </div>
          <div className="xl:col-span-1 grid gap-6">
            <SocialNetworks />
            <CreatorStudio />
          </div>
          <div className="xl:col-span-1">
            <ApiKeyManager />
          </div>
        </div>
      </main>
    </div>
  );
}
