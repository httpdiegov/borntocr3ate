"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { handleGenerateNewsBrief } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Generating..." : "Generate Brief"}
    </Button>
  );
}

export default function NewsBrief({ className }: { className?: string }) {
  const initialState = { newsBrief: null, message: "" };
  const [state, dispatch] = useActionState(handleGenerateNewsBrief, initialState);
  const { pending } = useFormStatus();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Relevant News
        </CardTitle>
        <CardDescription>
          Get a personalized news brief based on your interests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={dispatch} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interests">Interests</Label>
            <Input
              id="interests"
              name="interests"
              placeholder="e.g., artificial intelligence, space exploration, biotech"
              required
            />
          </div>
          <SubmitButton />
        </form>
        {state.message === "failed" && (
          <p className="text-destructive mt-4">{state.message}</p>
        )}
        <div className="mt-6">
          {pending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            state.newsBrief && (
              <div className="prose prose-invert text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <p>{state.newsBrief}</p>
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}