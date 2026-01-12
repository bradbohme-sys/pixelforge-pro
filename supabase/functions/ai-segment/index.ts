import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PinRequest {
  type: "discover" | "dye";
  imageBase64: string;
  pins?: Array<{ x: number; y: number; id: string; label?: string }>;
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
      // Enhanced prompt with comprehensive object detection
      prompt = `You are an expert image segmentation analyst. Analyze this image and identify ALL distinct, selectable objects.

VISUAL PROMINENCE RULE (10% Threshold):
- Objects occupying LESS than 10% of canvas area → treat as single "Semantic Parent" (e.g., "Person" not "Shirt, Face, Hair")
- Objects occupying MORE than 10% of canvas area → identify "Semantic Children" (e.g., for a large person: "Face", "Shirt", "Pants", "Hair")

DETECTION REQUIREMENTS:
1. Identify EVERY distinct object, including:
   - Main subjects (people, animals, objects)
   - Background elements (sky, ground, walls, furniture)
   - Partial objects visible at edges
   - Overlapping objects (identify each separately)
   
2. For each object provide:
   - Unique ID (e.g., "obj_1", "obj_2")
   - Semantic label (clear, descriptive name)
   - Centroid coordinates (x, y) - the CENTER point of the object
   - Estimated area percentage of canvas

3. Priority order:
   - Foreground objects first
   - Then mid-ground
   - Then background
   - Edge/partial objects last

Canvas size: ${canvasWidth}x${canvasHeight} pixels

RESPONSE FORMAT (JSON only):
{
  "pins": [
    { "id": "obj_1", "label": "Main Subject Face", "x": 512, "y": 200, "areaPercent": 8 },
    { "id": "obj_2", "label": "Shirt", "x": 512, "y": 400, "areaPercent": 15 },
    { "id": "obj_3", "label": "Background Sky", "x": 300, "y": 80, "areaPercent": 30 }
  ]
}

Be thorough - miss nothing that a user might want to select. Return ONLY the JSON object.`;

    } else if (type === "dye") {
      // Stage III: Dye Pass (Signal Layer Generation)
      // Enhanced prompt with object labels for better guidance
      model = "google/gemini-3-pro-image-preview";
      
      const pinDescriptions = pins?.map((p, i) => {
        const colorNames = ['Red', 'Green', 'Blue', 'Magenta', 'Yellow', 'Cyan', 'Orange', 'Purple', 'Spring Green', 'Pink', 'Lime', 'Sky Blue'];
        const color = colorNames[i % colorNames.length];
        return `• "${p.label || `Object ${i + 1}`}" at (${p.x}, ${p.y}) → Fill with ${color}`;
      }).join("\n") || "No pins provided";

      prompt = `You are creating a SEGMENTATION SIGNAL LAYER for precise algorithmic extraction.

TASK: Paint each identified object with a UNIQUE, SOLID, HIGH-CONTRAST color.

OBJECTS TO PAINT:
${pinDescriptions}

CRITICAL REQUIREMENTS:

1. COLOR ASSIGNMENT:
   - Use these exact colors in order: #FF0000 (Red), #00FF00 (Green), #0000FF (Blue), #FF00FF (Magenta), #FFFF00 (Yellow), #00FFFF (Cyan), #FF8000 (Orange), #8000FF (Purple)
   - Each object MUST have a DIFFERENT color
   - Colors must be FULLY SATURATED (100% saturation)

2. FILL STYLE:
   - Fill at 100% opacity (no transparency)
   - Use FLAT, SOLID fills - no gradients, no textures
   - Completely cover each object's area

3. EDGE PRECISION:
   - Edges must be HARD and ALIASED (no anti-aliasing)
   - Follow object boundaries EXACTLY
   - No bleeding between objects
   - No soft edges or feathering

4. COVERAGE:
   - Fill the ENTIRE area of each object
   - No gaps or unfilled regions within an object
   - Background should remain as neutral gray (#808080) or original if no pin

5. OUTPUT:
   - Render at the SAME resolution as the input image
   - This will be used for algorithmic color-matching, so precision is critical

The output will be sampled by a magic wand tool at each pin location - the color must be uniform across each object for accurate selection.`;

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

    console.log(`AI Segment: Processing ${type} request`);

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
      
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }
      
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Failed to parse pins, content:", content);
        throw new Error("Failed to parse pins from AI response");
      }
      
      const pinsData = JSON.parse(jsonMatch[0]);
      
      console.log(`AI Segment: Discovered ${pinsData.pins?.length || 0} objects`);
      
      return new Response(
        JSON.stringify({ success: true, pins: pinsData.pins }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Return the generated dye image
      const message = data.choices?.[0]?.message;
      let generatedImage = null;
      
      // Check for image in various response formats
      if (message?.images?.[0]?.image_url?.url) {
        generatedImage = message.images[0].image_url.url;
      } else if (message?.content && Array.isArray(message.content)) {
        // Handle array content format
        for (const item of message.content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            generatedImage = item.image_url.url;
            break;
          }
        }
      }
      
      const textContent = typeof message?.content === 'string' ? message.content : '';
      
      console.log(`AI Segment: Dye layer generated, has image: ${!!generatedImage}`);
      
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
