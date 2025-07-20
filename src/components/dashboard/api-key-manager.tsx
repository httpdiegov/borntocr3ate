"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Plus, Trash2, Copy, Eye, EyeOff, Pencil } from "lucide-react";

type ApiKey = {
  id: string;
  service: string;
  key: string;
};

export default function ApiKeyManager({ className }: { className?: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [service, setService] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const storedKeys = localStorage.getItem("apiKeys");
      if (storedKeys) {
        setKeys(JSON.parse(storedKeys));
      }
    } catch (error) {
      console.error("Failed to parse API keys from localStorage", error);
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("apiKeys", JSON.stringify(keys));
    }
  }, [keys, isMounted]);

  const handleSaveKey = () => {
    if (!service || !keyValue) {
      toast({
        title: "Error",
        description: "Service name and key cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (editingKeyId) {
      // Editing existing key
      const updatedKeys = keys.map((key) =>
        key.id === editingKeyId ? { ...key, service, key: keyValue } : key
      );
      setKeys(updatedKeys);
      toast({ title: "API Key updated successfully." });
    } else {
      // Adding new key
      const newKey = { id: crypto.randomUUID(), service, key: keyValue };
      const updatedKeys = [...keys, newKey];
      setKeys(updatedKeys);
      toast({ title: "API Key added successfully." });
    }

    closeDialog();
  };

  const handleEditClick = (key: ApiKey) => {
    setEditingKeyId(key.id);
    setService(key.service);
    setKeyValue(key.key);
    setDialogOpen(true);
  };
  
  const handleAddClick = () => {
    setEditingKeyId(null);
    setService("");
    setKeyValue("");
    setDialogOpen(true);
  }

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingKeyId(null);
    setService("");
    setKeyValue("");
  }


  const handleDeleteKey = (id: string) => {
    setKeys(keys.filter((key) => key.id !== id));
    toast({ title: "API Key deleted." });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isMounted) {
    return null; // or a loading skeleton
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            API Key Manager
          </CardTitle>
          <CardDescription>
            Store and manage your API keys securely in your browser.
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) closeDialog(); else setDialogOpen(true)}}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleAddClick}>
              <Plus className="h-4 w-4 mr-2" /> Add Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingKeyId ? "Edit API Key" : "Add New API Key"}</DialogTitle>
              <DialogDescription>
                {editingKeyId ? "Update the service name or API key." : "Enter the service name and the API key. It will be stored in your browser's local storage."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="service">Service Name</Label>
                <Input
                  id="service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="e.g. youtube_api_key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">API Key</Label>
                <Input
                  id="key"
                  type="password"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="Enter your key"
                />
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                </DialogClose>
                <Button onClick={handleSaveKey}>{editingKeyId ? "Save Changes" : "Save Key"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {keys.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="font-medium">{apiKey.service}</TableCell>
                  <TableCell className="font-mono">
                    {visibleKeys[apiKey.id] ? apiKey.key : "••••••••••••••••"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleVisibility(apiKey.id)}
                      aria-label={visibleKeys[apiKey.id] ? "Hide key" : "Show key"}
                    >
                      {visibleKeys[apiKey.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(apiKey.key)}
                      aria-label="Copy key"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(apiKey)}
                      aria-label="Edit key"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Delete key">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the API key for {apiKey.service}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteKey(apiKey.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p>No API keys stored.</p>
            <p className="text-sm">Click "Add Key" to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
