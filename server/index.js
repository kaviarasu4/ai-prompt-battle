// ============================================================
// AI PROMPT BATTLE
// SINGLE ROUND • IMAGE PROMPT COMPETITION
// ============================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

// Production-safe CORS
// Allows Vercel preview deployments and local development.
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// ============================================================
// ENVIRONMENT
// ============================================================

const PORT = process.env.PORT || 5000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ============================================================
// ENV VALIDATION
// ============================================================

if (!SUPABASE_URL) {
  console.error("❌ SUPABASE_URL missing in environment variables");
  process.exit(1);
}

if (!SUPABASE_SECRET_KEY) {
  console.error("❌ SUPABASE_SECRET_KEY missing in environment variables");
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY missing in environment variables");
  process.exit(1);
}

// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY
);

// ============================================================
// GEMINI
// ============================================================

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// ============================================================
// HELPERS
// ============================================================

function clampScore(value, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(max, Math.max(0, number));
}

function cleanFeedback(value) {
  if (typeof value !== "string") {
    return "Prompt evaluated successfully.";
  }

  return value.trim().slice(0, 500);
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Prompt Battle Server is running 🚀",
    mode: "Single Round - Image Prompt",
  });
});

// ============================================================
// CREATE EVENT
// ============================================================

app.post("/api/event", async (req, res) => {
  try {
    const {
      eventName,
      topN,
      ingredients,
    } = req.body;

    if (!eventName || !eventName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Event name is required.",
      });
    }

    if (!ingredients || !ingredients.trim()) {
      return res.status(400).json({
        success: false,
        message: "Ingredients are required.",
      });
    }

    const finalistCount = Number(topN);

    if (
      !Number.isInteger(finalistCount) ||
      finalistCount < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Top N finalists must be at least 1.",
      });
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        event_name: eventName.trim(),
        top_n: finalistCount,
        ingredients: ingredients.trim(),
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("CREATE EVENT ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    console.log(
      `✅ Event created: ${data.event_name}`
    );

    res.json({
      success: true,
      message: "Event created and submissions are now open.",
      event: data,
    });
  } catch (error) {
    console.error("CREATE EVENT ERROR:", error);

    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to create event.",
    });
  }
});

// ============================================================
// OPEN EVENT
// ============================================================

app.post("/api/open-event", async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required.",
      });
    }

    const { data, error } = await supabase
      .from("events")
      .update({
        status: "open",
      })
      .eq("id", eventId)
      .select()
      .single();

    if (error) {
      console.error("OPEN EVENT ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    res.json({
      success: true,
      message: "Submissions opened.",
      event: data,
    });
  } catch (error) {
    console.error("OPEN EVENT ERROR:", error);

    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to open event.",
    });
  }
});

// ============================================================
// CLOSE EVENT
// ============================================================

app.post("/api/close-event", async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required.",
      });
    }

    const {
      data: existingEvent,
      error: eventError,
    } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    if (existingEvent.status !== "open") {
      return res.status(400).json({
        success: false,
        message:
          `Event is already ${existingEvent.status}.`,
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

    if (error) {
      console.error("CLOSE EVENT ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    console.log(
      `🔒 Submissions closed: ${existingEvent.event_name}`
    );

    res.json({
      success: true,
      message: "Submissions closed.",
      event: data,
    });
  } catch (error) {
    console.error("CLOSE EVENT ERROR:", error);

    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to close event.",
    });
  }
});

// ============================================================
// AI JUDGE
// ============================================================

app.post("/api/judge", async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required.",
      });
    }

    console.log("");
    console.log("================================");
    console.log("       🤖 AI JUDGE STARTED");
    console.log("================================");

    // ========================================================
    // GET EVENT
    // ========================================================

    const {
      data: event,
      error: eventError,
    } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    if (event.status !== "closed") {
      return res.status(400).json({
        success: false,
        message:
          "Close submissions before starting AI judging.",
      });
    }

    // ========================================================
    // GET SUBMISSIONS
    // ========================================================

    const {
      data: submissions,
      error: submissionsError,
    } = await supabase
      .from("submissions")
      .select(`
        id,
        event_id,
        participant_id,
        prompt,
        created_at,
        participants (
          name,
          college_name
        )
      `)
      .eq("event_id", eventId)
      .order("created_at", {
        ascending: true,
      });

    if (submissionsError) {
      console.error(
        "GET SUBMISSIONS ERROR:",
        submissionsError
      );

      return res.status(500).json({
        success: false,
        message: submissionsError.message,
      });
    }

    if (
      !submissions ||
      submissions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No participant submissions found.",
      });
    }

    console.log(
      `👥 Submissions found: ${submissions.length}`
    );

    // ========================================================
    // JUDGE EACH PROMPT
    // ========================================================

    const judgedResults = [];
    const failedSubmissions = [];

    for (
      let i = 0;
      i < submissions.length;
      i++
    ) {
      const submission = submissions[i];

      const participantName =
        submission.participants?.name ||
        "Participant";

      const participantCollege =
        submission.participants?.college_name ||
        "";

      console.log(
        `🧠 Judging ${i + 1}/${submissions.length}: ${participantName}`
      );

      const promptText = String(
        submission.prompt || ""
      ).trim();

      if (!promptText) {
        failedSubmissions.push({
          submissionId: submission.id,
          participantName,
          reason: "Empty prompt.",
        });

        continue;
      }

      // ======================================================
      // GEMINI JUDGE PROMPT
      // ======================================================

      const judgePrompt = `
You are the official AI judge for a college IMAGE PROMPT WRITING competition.

This is a SINGLE ROUND competition.

Judge ONLY the participant's submitted written image-generation prompt.

The participant may have used ChatGPT, Gemini, Claude, or another AI tool to create the prompt. That is allowed and expected.

Judge the FINAL SUBMITTED PROMPT itself.

Do NOT judge whether the participant personally wrote it.

Do NOT reward or penalize AI assistance.

============================================================
CHALLENGE INGREDIENTS
============================================================

${event.ingredients}

============================================================
PARTICIPANT
============================================================

Name: ${participantName}

College: ${participantCollege}

============================================================
SUBMITTED IMAGE-GENERATION PROMPT
============================================================

"""
${promptText}
"""

============================================================
STRICT FAIRNESS RULES
============================================================

DO NOT judge:

- Generated image quality
- Any actual image
- Artwork quality
- Participant identity
- College reputation
- Participant popularity
- English fluency
- Grammar quality by itself
- Number of words
- Prompt length by itself
- Vocabulary complexity
- Fancy wording
- Unnecessary technical terminology
- AI tool used
- Whether the prompt looks AI-generated

A long prompt is NOT automatically better.

A short prompt is NOT automatically worse.

Complex English is NOT automatically better.

Simple English can receive a very high score if it communicates a strong visual concept effectively.

Judge the usefulness and quality of the visual idea expressed by the prompt.

============================================================
SCORING RUBRIC
============================================================

TOTAL = EXACTLY 100 POINTS

1. INGREDIENT INTEGRATION — 30 POINTS

Evaluate how effectively the prompt incorporates ALL THREE given ingredients.

Consider:

- Are all ingredients present?
- Are they meaningfully connected?
- Are they naturally integrated?
- Are they creatively used?

Do not give full marks simply because all three words appear.

2. CREATIVITY — 25 POINTS

Evaluate:

- Originality
- Imagination
- Conceptual transformation
- Visual uniqueness
- Interesting storytelling
- Interesting visual interpretation

Do NOT reward complicated vocabulary.

Reward the idea.

3. VISUAL DETAIL & SPECIFICITY — 25 POINTS

Evaluate useful visual information such as:

- Main subject
- Environment
- Composition
- Lighting
- Atmosphere
- Color direction
- Camera/framing when useful
- Materials
- Textures
- Clothing
- Objects
- Visual style
- Important visual details

Do NOT reward length by itself.

Only useful visual specificity should increase the score.

4. CHALLENGE RELEVANCE — 20 POINTS

Evaluate how strongly the complete prompt follows the actual challenge.

The prompt should transform the supplied ingredients into ONE coherent image-generation concept.

============================================================
IMPORTANT FAIRNESS PRINCIPLE
============================================================

Every participant must be judged using exactly the same rubric.

Do not compare:

- English skill
- Prompt length
- Vocabulary
- Writing style
- AI tools
- Participant background

Judge the final prompt's visual effectiveness.

============================================================
OUTPUT FORMAT
============================================================

Return ONLY valid JSON.

Do not use markdown.

Do not use code fences.

Do not add explanations outside JSON.

Required format:

{
  "ingredient_integration": 0,
  "creativity": 0,
  "prompt_detail": 0,
  "relevance": 0,
  "feedback": "Short professional feedback"
}

Maximum values:

ingredient_integration = 30
creativity = 25
prompt_detail = 25
relevance = 20

All values must be numeric.

Feedback must be concise and professional.
`;

      try {
        const response =
          await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: judgePrompt,
          });

        let text = response.text || "";

        text = text
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");

        if (
          start === -1 ||
          end === -1
        ) {
          throw new Error(
            "Gemini returned invalid JSON."
          );
        }

        const jsonText =
          text.substring(
            start,
            end + 1
          );

        const result =
          JSON.parse(jsonText);

        // ====================================================
        // SAFE SCORES
        // ====================================================

        const ingredientScore =
          clampScore(
            result.ingredient_integration,
            30
          );

        const creativityScore =
          clampScore(
            result.creativity,
            25
          );

        const detailScore =
          clampScore(
            result.prompt_detail,
            25
          );

        const relevanceScore =
          clampScore(
            result.relevance,
            20
          );

        const totalScore =
          ingredientScore +
          creativityScore +
          detailScore +
          relevanceScore;

        const feedback =
          cleanFeedback(
            result.feedback
          );

        // ====================================================
        // UPDATE SUBMISSION
        // ====================================================

        const {
          error: updateError,
        } = await supabase
          .from("submissions")
          .update({
            ai_score: totalScore,
            ai_feedback: feedback,

            ingredient_integration_score:
              ingredientScore,

            creativity_score:
              creativityScore,

            prompt_detail_score:
              detailScore,

            relevance_score:
              relevanceScore,

            judged: true,
          })
          .eq("id", submission.id);

        if (updateError) {
          throw updateError;
        }

        judgedResults.push({
          submissionId:
            submission.id,

          participantId:
            submission.participant_id,

          participantName,

          collegeName:
            participantCollege,

          score: totalScore,

          ingredientIntegrationScore:
            ingredientScore,

          creativityScore:
            creativityScore,

          detailScore:
            detailScore,

          relevanceScore:
            relevanceScore,

          feedback,

          originalSubmissionId:
            submission.id,
        });

        console.log(
          `   ✅ ${participantName}: ${totalScore}/100`
        );
      } catch (judgeError) {
        console.error(
          `❌ Judge failed for ${participantName}:`,
          judgeError.message
        );

        failedSubmissions.push({
          submissionId:
            submission.id,

          participantName,

          reason:
            judgeError.message,
        });
      }
    }

    // ========================================================
    // ENSURE ALL SUBMISSIONS WERE JUDGED
    // ========================================================

    if (
      failedSubmissions.length > 0
    ) {
      console.error(
        `❌ ${failedSubmissions.length} submissions failed judging.`
      );

      return res.status(500).json({
        success: false,

        message:
          "AI judging did not complete for every submission. Event remains closed. Please retry judging.",

        judgedCount:
          judgedResults.length,

        failedCount:
          failedSubmissions.length,

        failedSubmissions,
      });
    }

    if (
      judgedResults.length === 0
    ) {
      return res.status(500).json({
        success: false,

        message:
          "AI could not judge any submissions.",
      });
    }

    // ========================================================
    // DETERMINISTIC RANKING
    // ========================================================

    judgedResults.sort(
      (a, b) => {
        return (
          b.score -
            a.score ||

          b.ingredientIntegrationScore -
            a.ingredientIntegrationScore ||

          b.creativityScore -
            a.creativityScore ||

          b.detailScore -
            a.detailScore ||

          b.relevanceScore -
            a.relevanceScore ||

          a.originalSubmissionId.localeCompare(
            b.originalSubmissionId
          )
        );
      }
    );

    // ========================================================
    // ASSIGN RANK
    // ========================================================

    for (
      let i = 0;
      i < judgedResults.length;
      i++
    ) {
      const result =
        judgedResults[i];

      const {
        error: rankError,
      } = await supabase
        .from("submissions")
        .update({
          rank: i + 1,
        })
        .eq(
          "id",
          result.submissionId
        );

      if (rankError) {
        console.error(
          "RANK UPDATE ERROR:",
          rankError
        );

        return res.status(500).json({
          success: false,

          message:
            "AI judging completed but ranking could not be saved.",
        });
      }

      result.rank = i + 1;

      delete result.originalSubmissionId;
    }

    // ========================================================
    // TOP N FINALISTS
    // ========================================================

    const topN =
      Number(event.top_n) ||
      judgedResults.length;

    const finalists =
      judgedResults.slice(
        0,
        topN
      );

    // ========================================================
    // UPDATE EVENT STATUS
    // ========================================================

    const {
      error: statusError,
    } = await supabase
      .from("events")
      .update({
        status: "results",
      })
      .eq("id", eventId);

    if (statusError) {
      console.error(
        "EVENT STATUS ERROR:",
        statusError
      );

      return res.status(500).json({
        success: false,

        message:
          "Results generated but event status could not be updated.",
      });
    }

    // ========================================================
    // FINAL OUTPUT
    // ========================================================

    console.log("");
    console.log("================================");
    console.log("       🏆 JUDGING COMPLETE");
    console.log("================================");

    console.log(
      `Participants: ${judgedResults.length}`
    );

    console.log(
      `Top Finalists: ${Math.min(
        topN,
        judgedResults.length
      )}`
    );

    console.log(
      "================================"
    );

    console.log("");

    res.json({
      success: true,

      message:
        "AI judging completed successfully.",

      totalParticipants:
        judgedResults.length,

      topN,

      finalists,

      ranking:
        judgedResults,
    });
  } catch (error) {
    console.error(
      "AI JUDGE ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "AI judging failed.",
    });
  }
});

// ============================================================
// DELETE EVENT
// ============================================================

app.delete(
  "/api/event/:eventId",
  async (req, res) => {
    try {
      const {
        eventId,
      } = req.params;

      if (!eventId) {
        return res.status(400).json({
          success: false,
          message:
            "Event ID is required.",
        });
      }

      // ------------------------------------------------------
      // Check event exists
      // ------------------------------------------------------

      const {
        data: existingEvent,
        error: findError,
      } = await supabase
        .from("events")
        .select(
          "id, event_name"
        )
        .eq(
          "id",
          eventId
        )
        .single();

      if (
        findError ||
        !existingEvent
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Event not found.",
        });
      }

      // ------------------------------------------------------
      // Delete event
      // ------------------------------------------------------

      const {
        error: deleteError,
      } = await supabase
        .from("events")
        .delete()
        .eq(
          "id",
          eventId
        );

      if (deleteError) {
        console.error(
          "DELETE EVENT ERROR:",
          deleteError
        );

        return res.status(500).json({
          success: false,
          message:
            deleteError.message,
        });
      }

      console.log(
        `🗑️ Event deleted: ${existingEvent.event_name}`
      );

      res.json({
        success: true,

        message:
          "Event deleted successfully.",

        deletedEvent:
          existingEvent.event_name,
      });
    } catch (error) {
      console.error(
        "DELETE EVENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          error.message ||
          "Unable to delete event.",
      });
    }
  }
);

// ============================================================
// GET EVENT BY ID
// ============================================================

app.get(
  "/api/event/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const {
        data,
        error,
      } = await supabase
        .from("events")
        .select("*")
        .eq(
          "id",
          id
        )
        .single();

      if (
        error ||
        !data
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Event not found.",
        });
      }

      res.json({
        success: true,
        event: data,
      });
    } catch (error) {
      console.error(
        "GET EVENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// ============================================================
// GET LATEST EVENT
// ============================================================

app.get(
  "/api/latest-event",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("events")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(
          "LATEST EVENT ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message,
        });
      }

      res.json({
        success: true,
        event: data,
      });
    } catch (error) {
      console.error(
        "LATEST EVENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// ============================================================
// GET LEADERBOARD
// ============================================================

app.get(
  "/api/leaderboard/:eventId",
  async (req, res) => {
    try {
      const {
        eventId,
      } = req.params;

      const {
        data,
        error,
      } = await supabase
        .from("submissions")
        .select(`
          id,
          event_id,
          participant_id,
          prompt,
          ai_score,
          ai_feedback,
          ingredient_integration_score,
          creativity_score,
          prompt_detail_score,
          relevance_score,
          rank,
          judged,
          created_at,
          participants (
            name,
            college_name
          )
        `)
        .eq(
          "event_id",
          eventId
        )
        .not(
          "ai_score",
          "is",
          null
        )
        .order(
          "rank",
          {
            ascending: true,
          }
        );

      if (error) {
        console.error(
          "LEADERBOARD ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message,
        });
      }

      res.json({
        success: true,
        ranking:
          data || [],
      });
    } catch (error) {
      console.error(
        "LEADERBOARD ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// ============================================================
// SERVER START
// ============================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "================================"
    );
    console.log(
      "   🤖 AI PROMPT BATTLE SERVER"
    );
    console.log(
      "================================"
    );
    console.log("");

    console.log(
      `🚀 Server running on port ${PORT}`
    );

    console.log(
      "🧠 Gemini AI Judge: Ready"
    );

    console.log(
      "🗄️ Supabase: Connected"
    );

    console.log(
      "🎨 Mode: SINGLE IMAGE PROMPT ROUND"
    );

    console.log("");

    console.log(
      "================================"
    );

    console.log("");
  }
);