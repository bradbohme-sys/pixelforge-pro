import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PinRequest {
  type: "discover" | "dye";
  imageBase64: string;
  pins?: Array<{ x: number; y: number; id: string }>;
  canvasWidth: number;
  canvasHeight: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, imageBase64, pins, canvasWidth, canvasHeight }: PinRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let prompt: string;
    let model = "google/gemini-2.5-flash";

    if (type === "discover") {
      // Stage II: Discovery Pass (Pinning)
      // Uses 10% threshold rule for visual prominence
      prompt = `You are an image segmentation expert. Analyze this image and identify all distinct objects that should be selectable.

VISUAL PROMINENCE RULE (10% Threshold):
- If an entity occupies LESS than 10% of the canvas area, treat it as a single "Semantic Parent" (e.g., "Person" not "Shirt, Face, Hair")
- If an entity occupies MORE than 10% of the canvas area, identify its "Semantic Children" (e.g., "Shirt", "Face", "Hair", "Background")

Canvas size: ${canvasWidth}x${canvasHeight} pixels

For each identified object, provide:
1. A unique ID (e.g., "obj_1", "obj_2")
2. The semantic label (what the object is)
3. The centroid coordinates (x, y) where a pin should be placed
4. Estimated area percentage of the canvas

Return a JSON object with this structure:
{
  "pins": [
    { "id": "obj_1", "label": "Sky", "x": 512, "y": 100, "areaPercent": 25 },
    { "id": "obj_2", "label": "Mountain", "x": 512, "y": 300, "areaPercent": 40 }
  ]
}

Only return the JSON, no other text.`;

    } else if (type === "dye") {
      // Stage III: Dye Pass (Signal Layer Generation)
      // Uses Nano Banana Pro for high-quality image generation
      model = "google/gemini-3-pro-image-preview";
      
      const pinDescriptions = pins?.map((p, i) => 
        `Pin ${i + 1} at (${p.x}, ${p.y}) with ID "${p.id}"`
      ).join("\n") || "No pins provided";

      prompt = `You are creating a segmentation signal layer. Using the pin locations as anchors, flood-fill the object belonging to each pin with a unique, high-contrast categorical color.

PIN LOCATIONS:
${pinDescriptions}

REQUIREMENTS:
1. Each object should be filled with a unique, bright color (e.g., #FF0000, #00FF00, #0000FF, #FF00FF, #FFFF00, #00FFFF)
2. Render at 75% opacity over the original texture
3. Edges must be HARD/ALIASED - strictly adhere to object boundaries
4. Every pin's object MUST have a distinct color from all other objects
5. The background should remain unfilled or use a neutral gray

This output will be used by an algorithmic system to create precise selections, so edge accuracy is critical.`;

    } else {
      throw new Error(`Unknown request type: ${type}`);
    }

    // Build message content
    const messageContent: any[] = [
      { type: "text", text: prompt }
    ];

    // Add image if provided
    if (imageBase64) {
      messageContent.push({
        type: "image_url",
        image_url: {
          url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`
        }
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: messageContent }
        ],
        ...(type === "dye" ? { modalities: ["image", "text"] } : {})
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    if (type === "discover") {
      // Parse the pins from the text response
      const content = data.choices?.[0]?.message?.content || "";
      
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse pins from AI response");
      }
      
      const pinsData = JSON.parse(jsonMatch[0]);
      
      return new Response(
        JSON.stringify({ success: true, pins: pinsData.pins }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Return the generated dye image
      const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const textContent = data.choices?.[0]?.message?.content || "";
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          dyeImage: generatedImage,
          message: textContent 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("AI segment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
