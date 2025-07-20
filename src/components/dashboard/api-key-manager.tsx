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
import { KeyRound, Save, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { updateApiKey } from "@/ai/flows/update-api-key";

type ServiceKey = "youtube_api_key" | "instagram_access_token" | "instagram_business_account_id";

const apiKeys: { name: string; key: ServiceKey }[] = [
  { name: "YouTube API Key", key: "youtube_api_key" },
  { name: "Instagram Access Token", key: "instagram_access_token" },
  { name: "Instagram Business Account ID", key: "instagram_business_account_id" },
];

export default function ApiKeyManager({ className }: { className?: string }) {
  const [keyValues, setKeyValues] = useState<Record<ServiceKey, string>>(
    {} as Record<ServiceKey, string>
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (key: ServiceKey, value: string) => {
    setKeyValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveKey = async (key: ServiceKey) => {
    const value = keyValues[key];
    if (!value) {
      toast({
        title: "Error",
        description: "Key value cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await updateApiKey({ service: key, value });
      toast({
        title: "Success",
        description: `${key} has been updated. NOTE: Server restart may be required for changes to take effect.`,
      });
    } catch (error: any) {
      console.error("Failed to save API key:", error);
      toast({
        title: "Failed to save key",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-6 w-6" />
          API Key Manager
        </CardTitle>
        <CardDescription>
          Manage your third-party API keys securely. These are stored server-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {apiKeys.map(({ name, key }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key}>{name}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={key}
                type="password"
                placeholder={`Enter ${name}`}
                value={keyValues[key] || ""}
                onChange={(e) => handleInputChange(key, e.target.value)}
                disabled={loading}
              />
              <Button onClick={() => handleSaveKey(key)} disabled={loading || !keyValues[key]}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="sr-only">Save</span>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
