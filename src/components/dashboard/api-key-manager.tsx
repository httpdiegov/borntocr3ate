
"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Save, Loader2, Plus, Eye, EyeOff, Edit, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { updateApiKey } from "@/ai/flows/update-api-key";
import { areApiKeysSet } from "@/ai/flows/are-api-keys-set";
import { Separator } from "@/components/ui/separator";

const predefinedApiKeys: { name: string; key: string }[] = [
  { name: "Gemini API Key", key: "GEMINI_API_KEY" },
  { name: "YouTube API Key", key: "youtube_api_key" },
  { name: "Instagram Access Token", key: "instagram_access_token" },
  { name: "Instagram Business Account ID", key: "instagram_business_account_id" },
];

export default function ApiKeyManager({ className }: { className?: string }) {
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [setKeys, setSetKeys] = useState<string[]>([]);
  const [checkingKeys, setCheckingKeys] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function checkKeys() {
      setCheckingKeys(true);
      try {
        const keyNames = predefinedApiKeys.map(k => k.key);
        const result = await areApiKeysSet({ services: keyNames });
        setSetKeys(result.setKeys);
      } catch (error) {
        console.error("Failed to check API key status:", error);
        toast({
          title: "Could not check key status",
          description: "There was an error checking the status of the API keys.",
          variant: "destructive"
        });
      } finally {
        setCheckingKeys(false);
      }
    }
    checkKeys();
  }, [toast]);


  const handleInputChange = (key: string, value: string) => {
    setKeyValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEdit = (key: string) => {
    setEditingKey(key);
    setKeyValues((prev) => ({ ...prev, [key]: '' })); // Clear value on edit
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
  };

  const handleSaveKey = async (key: string, name: string) => {
    const value = keyValues[key];
    if (!value) {
      toast({
        title: "Error",
        description: "Key value cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setLoadingKey(key);
    try {
      const result = await updateApiKey({ service: key, value });
      if (result.success) {
        toast({
          title: "Success",
          description: result.message || `${name} has been updated.`,
        });
        setKeyValues((prev) => ({...prev, [key]: ''})); // Clear input on success
        if (!setKeys.includes(key)) {
            setSetKeys([...setKeys, key]); // Mark key as set
        }
        setEditingKey(null); // Exit edit mode
      } else {
         throw new Error(result.message || 'An unknown error occurred.');
      }
    } catch (error: any) {
      console.error("Failed to save API key:", error);
      toast({
        title: "Failed to save key",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingKey(null);
    }
  };

  const handleAddNewKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      toast({
        title: "Error",
        description: "Both secret name and value are required.",
        variant: "destructive",
      });
      return;
    }

    setLoadingKey('new_key');
    try {
      const result = await updateApiKey({ service: newKeyName.trim(), value: newKeyValue.trim() });
      if (result.success) {
        toast({
          title: "Success",
          description: `New secret '${newKeyName.trim()}' has been saved. You might need to refresh the page to see it in a predefined list.`,
        });
        setNewKeyName(""); 
        setNewKeyValue("");
      } else {
         throw new Error(result.message || 'An unknown error occurred.');
      }
    } catch (error: any) {
      console.error("Failed to save new API key:", error);
      toast({
        title: "Failed to save new key",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingKey(null);
    }
  };

  const isLoadingNew = loadingKey === 'new_key';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-6 w-6" />
          API Key Manager
        </CardTitle>
        <CardDescription>
          Manage predefined application keys or add new ones to Google Secret Manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {checkingKeys ? (
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="animate-spin mr-2" />
            <span>Checking key status...</span>
          </div>
        ) : (
          <div className="space-y-4">
             <h3 className="text-lg font-medium">Predefined Secrets</h3>
            {predefinedApiKeys.map(({ name, key }) => {
              const isSet = setKeys.includes(key);
              const isEditing = editingKey === key;
              const isLoading = loadingKey === key;
              const isReadOnly = !isEditing && isSet;
              const isVisible = visibleKeys[key];

              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{name}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={key}
                      type={isEditing && isVisible ? "text" : "password"}
                      placeholder={isSet && !isEditing ? "" : "Enter key value..."}
                      value={isReadOnly ? "••••••••••••••••" : (keyValues[key] || "")}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      readOnly={isReadOnly}
                      className={isReadOnly ? "cursor-default focus-visible:ring-0" : ""}
                      disabled={isLoading}
                    />
                    {isEditing && (
                      <Button variant="ghost" size="icon" onClick={() => toggleVisibility(key)} disabled={isLoading}>
                        {isVisible ? <EyeOff /> : <Eye />}
                        <span className="sr-only">
                          {isVisible ? 'Hide' : 'Show'} key while editing
                        </span>
                      </Button>
                    )}
                    
                    {isEditing ? (
                      <>
                        <Button onClick={() => handleSaveKey(key, name)} disabled={isLoading || !keyValues[key]} size="icon">
                          {isLoading ? <Loader2 className="animate-spin" /> : <Save />}
                          <span className="sr-only">Save {name}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleCancelEdit} disabled={isLoading}>
                           <X />
                           <span className="sr-only">Cancel edit</span>
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="icon" onClick={() => handleEdit(key)} disabled={isLoading}>
                        <Edit />
                        <span className="sr-only">Edit {name}</span>
                      </Button>
                    )}

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-4 pt-6">
          <Separator />
          <div className="w-full space-y-2 mt-4">
             <h3 className="text-lg font-medium">Add New Secret</h3>
             <div className="space-y-2">
                <Label htmlFor="newKeyName">Secret Name</Label>
                 <Input
                    id="newKeyName"
                    placeholder="e.g., MY_CUSTOM_API_KEY"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    disabled={isLoadingNew}
                 />
             </div>
             <div className="space-y-2">
                <Label htmlFor="newKeyValue">Secret Value</Label>
                 <div className="flex items-center gap-2">
                   <Input
                      id="newKeyValue"
                      type={visibleKeys['new_key'] ? 'text' : 'password'}
                      placeholder="Enter the secret value"
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      disabled={isLoadingNew}
                   />
                    <Button variant="ghost" size="icon" onClick={() => toggleVisibility('new_key')} disabled={isLoadingNew}>
                      {visibleKeys['new_key'] ? <EyeOff /> : <Eye />}
                      <span className="sr-only">Toggle new key visibility</span>
                    </Button>
                 </div>
             </div>
              <Button onClick={handleAddNewKey} disabled={isLoadingNew || !newKeyName || !newKeyValue}>
                {isLoadingNew ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Plus className="mr-2" />
                )}
                Add New Secret
              </Button>
          </div>
      </CardFooter>
    </Card>
  );
}
