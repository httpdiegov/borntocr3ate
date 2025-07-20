"use server";

import {
  generateNewsBrief,
  type GenerateNewsBriefInput,
} from "@/ai/flows/generate-news-brief";

export async function handleGenerateNewsBrief(prevState: any, formData: FormData) {
  try {
    const input: GenerateNewsBriefInput = {};
    const result = await generateNewsBrief(input);
    return { newsItems: result.newsItems, message: "success" };
  } catch (error) {
    console.error(error);
    return { message: "Failed to generate news brief.", newsItems: null };
  }
}
