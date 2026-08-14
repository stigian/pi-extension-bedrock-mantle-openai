import type { Model, ThinkingLevelMap } from "@earendil-works/pi-ai";

export interface BedrockMantleModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  thinkingLevelMap: ThinkingLevelMap;
}

export const MODELS: BedrockMantleModelConfig[] = [
  {
    id: "openai.gpt-5.4",
    name: "GPT-5.4 (Bedrock Mantle)",
    reasoning: true,
    input: ["text"],
    contextWindow: 272000,
    maxTokens: 128000,
    cost: {
      input: 2.5,
      output: 10.0,
      cacheRead: 1.25,
      cacheWrite: 2.5,
    },
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: null,
    },
  },
  {
    id: "openai.gpt-5.5",
    name: "GPT-5.5 (Bedrock Mantle)",
    reasoning: true,
    input: ["text"],
    contextWindow: 272000,
    maxTokens: 128000,
    cost: {
      input: 3.0,
      output: 12.0,
      cacheRead: 1.5,
      cacheWrite: 3.0,
    },
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: null,
    },
  },
  {
    id: "openai.gpt-5.6-sol",
    name: "GPT-5.6 Sol (Bedrock Mantle)",
    reasoning: true,
    input: ["text"],
    contextWindow: 1000000,
    maxTokens: 128000,
    cost: {
      input: 5.0,
      output: 30.0,
      cacheRead: 2.5,
      cacheWrite: 5.0,
    },
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
    },
  },
  {
    id: "openai.gpt-5.6-terra",
    name: "GPT-5.6 Terra (Bedrock Mantle)",
    reasoning: true,
    input: ["text"],
    contextWindow: 1000000,
    maxTokens: 128000,
    cost: {
      input: 2.5,
      output: 15.0,
      cacheRead: 1.25,
      cacheWrite: 2.5,
    },
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
    },
  },
  {
    id: "openai.gpt-5.6-luna",
    name: "GPT-5.6 Luna (Bedrock Mantle)",
    reasoning: true,
    input: ["text"],
    contextWindow: 1000000,
    maxTokens: 128000,
    cost: {
      input: 1.0,
      output: 4.0,
      cacheRead: 0.5,
      cacheWrite: 1.0,
    },
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
    },
  },
];
