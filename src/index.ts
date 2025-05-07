#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Anthropic } from "@anthropic-ai/sdk";
import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Define anthropic
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Define MCP 
const server = new McpServer({ name: "md-server", version: "1.0.0" });
// Define allowed directory for .md files
const DOCS_DIR = path.resolve(process.cwd(), "docs");


server.tool("summarize_md_file", {
    filePath: z
        .string()
        .refine((p) => p.endsWith(".md"), { message: "File must be a .md file" })
        .refine((p) => {
        const absolutePath = path.resolve(process.cwd(), p);
        return absolutePath.startsWith(DOCS_DIR);
    }, { message: "File must be in the 'docs/' directory" }),
}, async ({ filePath }) => {
    try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const content = await fs.readFile(absolutePath, "utf-8");
        // Placeholder: Truncate content for now; replace with LLM summarization later
        // const summary = content.slice(0, 100); // Truncate to first 100 chars
        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 100,
            messages: [{ role: "user", content: `Summarize this markdown content in 2-3 sentences: ${content}` }],
          });
        // const summary = response.content[0].text;
        // return { content: [{ type: "text", text: summary }] };
        const firstContent = response.content[0];
        if (firstContent.type === "text") {
            const summary = firstContent.text;
            return { content: [{ type: "text", text: summary }] };
          }
          throw new Error("Expected text content from Claude");
    }
    catch (error) {
        // Safely handle the error
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
            content: [{ type: "text", text: `Error reading file: ${errorMessage}` }],
            isError: true,
        };
    }
});
const transport = new StdioServerTransport();
server.connect(transport);
