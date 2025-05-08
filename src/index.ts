#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Anthropic } from "@anthropic-ai/sdk";
import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

// define .env path for claude desktop
dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const server = new McpServer({ name: "md-server", version: "1.0.0" });
console.error("Current working directory:", process.cwd());
const DOCS_DIR = path.resolve(process.cwd(), "docs");
console.error("DOCS_DIR:", DOCS_DIR);

server.tool(
  "summarize_md_file",
  {
    filePath: z
      .string()
      .refine((p) => p.endsWith(".md"), { message: "File must be a .md file" })
      .refine(
        (p) => {
          const cleanPath = p.replace(/^\/?(docs\/)?/, "");
          const absolutePath = path.resolve(DOCS_DIR, cleanPath);
          console.error("Input filePath:", p, "Cleaned:", cleanPath, "Validated path:", absolutePath);
          return absolutePath.startsWith(DOCS_DIR);
        },
        { message: "File must be relative to 'docs/' (e.g., 'file1.md')" }
      ),
  },
  async ({ filePath }: { filePath: string }) => {
    try {
      const cleanPath = filePath.replace(/^\/?(docs\/)?/, "");
      const absolutePath = path.resolve(DOCS_DIR, cleanPath);
      console.error("Resolved path:", absolutePath);
      const content = await fs.readFile(absolutePath, "utf-8");
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 100,
        messages: [{ role: "user", content: `Summarize this markdown content in 2-3 sentences: ${content}` }],
      });
      const firstContent = response.content[0];
      if (firstContent.type === "text") {
        const summary = firstContent.text;
        return { content: [{ type: "text", text: summary }] };
      }
      throw new Error("Expected text content from Claude");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error reading file: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
server.connect(transport);