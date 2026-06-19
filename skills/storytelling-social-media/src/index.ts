#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_MD = readFileSync(join(__dirname, "../SKILL.md"), "utf-8");

const client = new Anthropic();

const server = new Server(
  {
    name: "storytelling-social-media",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "crear_contenido",
        description:
          "Crea contenido viral con storytelling para redes sociales. Aplica fórmulas como Así que–Para qué, Efecto Manzana o Método Hilos según la plataforma y objetivo.",
        inputSchema: {
          type: "object",
          properties: {
            idea: {
              type: "string",
              description: "La idea, dato o tema base para el contenido",
            },
            plataforma: {
              type: "string",
              enum: ["LinkedIn", "TikTok", "Instagram", "Twitter/X", "general"],
              description: "Plataforma de destino del contenido",
            },
            formato: {
              type: "string",
              enum: ["post", "reel", "carrusel", "thread", "historia"],
              description: "Formato del contenido a crear",
            },
            formula: {
              type: "string",
              enum: [
                "Así que-Para qué",
                "Efecto Manzana",
                "Método Hilos",
                "auto",
              ],
              description:
                "Fórmula de storytelling a usar. 'auto' elige la más adecuada.",
              default: "auto",
            },
            tono: {
              type: "string",
              enum: [
                "inspiracional",
                "educativo",
                "personal",
                "provocador",
                "conversacional",
              ],
              description: "Tono del contenido",
              default: "inspiracional",
            },
          },
          required: ["idea", "plataforma", "formato"],
        },
      },
      {
        name: "generar_hook",
        description:
          "Genera hooks virales de apertura para captar atención en los primeros 3 segundos según la plataforma.",
        inputSchema: {
          type: "object",
          properties: {
            tema: {
              type: "string",
              description: "Tema o concepto central del contenido",
            },
            plataforma: {
              type: "string",
              enum: ["LinkedIn", "TikTok", "Instagram", "Twitter/X"],
              description: "Plataforma objetivo",
            },
            cantidad: {
              type: "number",
              description: "Cantidad de hooks a generar (1-5)",
              default: 3,
              minimum: 1,
              maximum: 5,
            },
          },
          required: ["tema", "plataforma"],
        },
      },
      {
        name: "analizar_contenido",
        description:
          "Analiza contenido existente y sugiere mejoras usando las fórmulas de storytelling viral.",
        inputSchema: {
          type: "object",
          properties: {
            contenido: {
              type: "string",
              description: "El contenido actual a analizar y mejorar",
            },
            plataforma: {
              type: "string",
              enum: ["LinkedIn", "TikTok", "Instagram", "Twitter/X", "general"],
              description: "Plataforma donde se publicará",
            },
          },
          required: ["contenido"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "crear_contenido") {
    const { idea, plataforma, formato, formula = "auto", tono = "inspiracional" } = args as {
      idea: string;
      plataforma: string;
      formato: string;
      formula?: string;
      tono?: string;
    };

    const prompt = `${SKILL_MD}

---

El usuario quiere crear el siguiente contenido:
- **Idea base:** ${idea}
- **Plataforma:** ${plataforma}
- **Formato:** ${formato}
- **Fórmula:** ${formula === "auto" ? "Elige la más adecuada según la idea y plataforma" : formula}
- **Tono:** ${tono}

Crea el contenido completo listo para publicar, incluyendo:
1. Hook de apertura viral adaptado a ${plataforma}
2. Cuerpo con la fórmula de storytelling elegida
3. CTA (llamada a la acción) al final
4. Si aplica: hashtags relevantes (máximo 5)

Responde directamente con el contenido, sin explicaciones previas.`;

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: "adaptive" } as any,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return { content: [{ type: "text", text }] };
  }

  if (name === "generar_hook") {
    const { tema, plataforma, cantidad = 3 } = args as {
      tema: string;
      plataforma: string;
      cantidad?: number;
    };

    const prompt = `${SKILL_MD}

---

Genera exactamente ${cantidad} hooks virales de apertura para ${plataforma} sobre el tema: "${tema}"

Cada hook debe:
- Durar máximo 3 segundos de lectura
- Generar curiosidad, urgencia o identificación inmediata
- Estar adaptado al estilo de ${plataforma}
- Ser diferente al anterior en estructura y emoción

Formato de respuesta:
**Hook 1:** [texto]
**Hook 2:** [texto]
... y así sucesivamente

Sin explicaciones adicionales.`;

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return { content: [{ type: "text", text }] };
  }

  if (name === "analizar_contenido") {
    const { contenido, plataforma = "general" } = args as {
      contenido: string;
      plataforma?: string;
    };

    const prompt = `${SKILL_MD}

---

Analiza el siguiente contenido para ${plataforma} y mejóralo usando las fórmulas de storytelling:

---CONTENIDO ORIGINAL---
${contenido}
---FIN CONTENIDO---

Proporciona:
1. **Diagnóstico rápido** (2-3 líneas): qué funciona y qué falla
2. **Fórmula recomendada** y por qué
3. **Versión mejorada** completa lista para publicar
4. **Hook alternativo** más fuerte`;

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: "adaptive" } as any,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return { content: [{ type: "text", text }] };
  }

  throw new Error(`Tool not found: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Storytelling Social Media MCP server running on stdio");
}

main().catch(console.error);
