"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Plus, Trash2 } from "lucide-react";

type Idea = {
  id: string;
  text: string;
  timestamp: Date;
};

export default function Ideari({ className }: { className?: string }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const { toast } = useToast();

  const handleAddIdea = () => {
    if (newIdea.trim()) {
      setIdeas([
        { id: crypto.randomUUID(), text: newIdea, timestamp: new Date() },
        ...ideas,
      ]);
      setNewIdea("");
      toast({ title: "Idea captured!" });
    } else {
        toast({ title: "Idea can't be empty.", variant: "destructive" });
    }
  };

  const handleDeleteIdea = (id: string) => {
    setIdeas(ideas.filter((idea) => idea.id !== id));
    toast({ title: "Idea removed." });
  };

  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-6 w-6" />
          Ideari
        </CardTitle>
        <CardDescription>
          A dedicated space to jot down, organize, and develop ideas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2">
          <Textarea
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
          />
          <Button onClick={handleAddIdea} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Idea
          </Button>
        </div>
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {ideas.length > 0 ? (
            ideas.map((idea) => (
              <Card key={idea.id} className="bg-card/50">
                <CardContent className="p-4 flex justify-between items-start">
                  <p className="text-sm text-card-foreground break-words w-[calc(100%-3rem)]">
                    {idea.text}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteIdea(idea.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <p>Your mind is clear.</p>
              <p className="text-sm">Add an idea to get started.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
