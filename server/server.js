import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 5000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


// ============================================
// HOME
// ============================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🤖 AI Prompt Battle Server Online",
  });
});


// ============================================
// HEALTH
// ============================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    server: true,
    supabase: !!process.env.SUPABASE_URL,
    gemini: !!process.env.GEMINI_API_KEY,
  });
});


// ============================================
// CREATE EVENT
// ============================================

app.post("/api/event", async (req, res) => {
  try {
    const {
      eventName,
      topN,
      ingredients,
    } = req.body;

    if (!eventName || !ingredients) {
      return res.status(400).json({
        success: false,
        message: "Event name and ingredients are required",
      });
    }

    // Close previous events
    await supabase
      .from("events")
      .update({
        status: "closed",
      })
      .neq("status", "closed");

    const { data, error } = await supabase
      .from("events")
      .insert({
        event_name: eventName,
        top_n: Number(topN) || 5,
        ingredients,
        status: "open",
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Event created successfully 🎉",
      event: data,
    });

  } catch (error) {
    console.error("CREATE EVENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// ============================================
// CLOSE SUBMISSIONS
// ============================================

app.post("/api/close-event", async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "eventId is required",
      });
    }

    const { data, error } = await supabase
      .from("events")
      .update({
        status: "closed",
      })
      .eq("id", eventId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Submission closed 🔒",
      event: data,
    });

  } catch (error) {
    console.error("CLOSE EVENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// ============================================
// OPEN SUBMISSIONS
// ============================================

app.post("/api/open-event", async (req, res) => {
  try {
    const { eventId } = req.body;

    const { data, error } = await supabase
      .from("events")
      .update({
        status: "open",
      })
      .eq("id", eventId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Submission opened 🚀",
      event: data,
    });

  } catch (error) {
    console.error("OPEN EVENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// ============================================
// GEMINI
// ============================================

async function askGemini(prompt) {

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });

  return response.text;
}


// ============================================
// JSON PARSER
// ============================================

function parseJSON(text) {

  try {
    return JSON.parse(text);
  } catch {}

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);

  if (match) {
    return JSON.parse(match[0]);
  }

  throw new Error("Invalid Gemini JSON response");
}


// ============================================
// AI JUDGE
// ============================================

app.post("/api/judge", async (req, res) => {

  try {

    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "eventId is required",
      });
    }


    // ----------------------------------------
    // EVENT
    // ----------------------------------------

    const { data: event, error: eventError } =
      await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

    if (eventError) throw eventError;


    // ----------------------------------------
    // SUBMISSIONS
    // ----------------------------------------

    const { data: submissions, error: submissionError } =
      await supabase
        .from("submissions")
        .select(`
          *,
          participants (
            name,
            college_name
          )
        `)
        .eq("event_id", eventId);

    if (submissionError) throw submissionError;


    if (!submissions || submissions.length === 0) {

      return res.status(400).json({
        success: false,
        message: "No submissions found",
      });

    }


    const results = [];


    // ----------------------------------------
    // JUDGE EACH PROMPT
    // ----------------------------------------

    for (const submission of submissions) {

      const participant = submission.participants;

      const judgePrompt = `

You are the official AI Judge for a college-level
AI IMAGE PROMPT BATTLE.

IMPORTANT:

Judge ONLY the participant's written IMAGE GENERATION PROMPT.

DO NOT judge an actual generated image.

This is a PROMPT WRITING competition.

--------------------------------
EVENT INGREDIENTS
--------------------------------

${event.ingredients}

--------------------------------
PARTICIPANT PROMPT
--------------------------------

${submission.prompt}

--------------------------------
SCORING RUBRIC
--------------------------------

Ingredient Integration = 30 points

Creativity = 25 points

Prompt Detail = 25 points

Relevance = 20 points

TOTAL = 100 POINTS

--------------------------------
JUDGING RULES
--------------------------------

Ingredient Integration:
How naturally and completely are all ingredients
included in the prompt?

Creativity:
How original and imaginative is the concept?

Prompt Detail:
Does the prompt describe subject, environment,
lighting, composition, camera, style, atmosphere,
colors, details etc.?

Relevance:
Does the prompt directly follow the challenge?

Be fair.

Do not give everyone the same score.

Do not judge the participant's name or college.

Return ONLY JSON.

{
  "ingredient_integration": 0,
  "creativity": 0,
  "prompt_detail": 0,
  "relevance": 0,
  "total": 0,
  "feedback": ""
}

`;


      try {

        const raw = await askGemini(judgePrompt);

        const result = parseJSON(raw);


        const ingredient = Math.min(
          30,
          Math.max(
            0,
            Number(result.ingredient_integration) || 0
          )
        );


        const creativity = Math.min(
          25,
          Math.max(
            0,
            Number(result.creativity) || 0
          )
        );


        const detail = Math.min(
          25,
          Math.max(
            0,
            Number(result.prompt_detail) || 0
          )
        );


        const relevance = Math.min(
          20,
          Math.max(
            0,
            Number(result.relevance) || 0
          )
        );


        const total =
          ingredient +
          creativity +
          detail +
          relevance;


        await supabase
          .from("submissions")
          .update({

            ai_score: total,

            ai_feedback:
              result.feedback || "",

            ingredient_integration_score:
              ingredient,

            creativity_score:
              creativity,

            prompt_detail_score:
              detail,

            relevance_score:
              relevance,

            judged: true,

          })
          .eq("id", submission.id);


        results.push({

          participantId:
            submission.participant_id,

          participantName:
            participant?.name,

          collegeName:
            participant?.college_name,

          score: total,

          feedback:
            result.feedback || "",

        });


      } catch (judgeError) {

        console.error(
          "GEMINI JUDGE ERROR:",
          judgeError
        );

      }

    }


    // ----------------------------------------
    // RANK
    // ----------------------------------------

    results.sort(
      (a, b) => b.score - a.score
    );


    for (let i = 0; i < results.length; i++) {

      results[i].rank = i + 1;

      await supabase
        .from("submissions")
        .update({
          rank: i + 1,
        })
        .eq(
          "event_id",
          eventId
        )
        .eq(
          "participant_id",
          results[i].participantId
        );

    }


    // ----------------------------------------
    // RESULTS
    // ----------------------------------------

    await supabase
      .from("events")
      .update({
        status: "results",
      })
      .eq("id", eventId);


    const topN =
      Number(event.top_n) || 5;


    const finalists =
      results.slice(0, topN);


    res.json({

      success: true,

      message:
        "AI judging completed successfully 🎉",

      totalParticipants:
        results.length,

      topN,

      finalists,

      ranking:
        results,

    });


  } catch (error) {

    console.error(
      "AI JUDGE ERROR:",
      error
    );

    res.status(500).json({

      success: false,

      message: error.message,

    });

  }

});


// ============================================
// SERVER
// ============================================

app.listen(PORT, () => {

  console.log(`
========================================
       🤖 AI PROMPT BATTLE
========================================

🚀 Server: http://localhost:${PORT}

🧠 Gemini AI Judge: Ready

🗄️ Supabase: Connected

🎨 Mode: SINGLE IMAGE ROUND

========================================
`);

});