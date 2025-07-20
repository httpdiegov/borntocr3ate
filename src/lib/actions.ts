"use server";

import {
  generateNewsBrief,
  type GenerateNewsBriefInput,
} from "@/ai/flows/generate-news-brief";
import { z } from "zod";

const NewsBriefSchema = z.object({
  interests: z.string().min(3, "Please enter at least one interest."),
});

export async function handleGenerateNewsBrief(prevState: any, formData: FormData) {
  const validatedFields = NewsBriefSchema.safeParse({
    interests: formData.get("interests"),
  });

  if (!validatedFields.success) {
    return {
      message: "Invalid interests.",
      errors: validatedFields.error.flatten().fieldErrors,
      newsBrief: null,
    };
  }
  
  try {
    const input: GenerateNewsBriefInput = {
      interests: validatedFields.data.interests,
    };
    const result = await generateNewsBrief(input);
    return { newsBrief: result.newsBrief, message: "success" };
  } catch (error) {
    console.error(error);
    return { message: "Failed to generate news brief.", newsBrief: null };
  }
}
