import { useEffect, useState } from "react";
import {
  Sparkles,
  User,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trophy,
  BrainCircuit,
  Users,
  Medal,
  Loader2,
  Target,
  Wand2,
  ClipboardList,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { supabase } from "./supabase";
import "./App.css";

// ============================================================
// API URL
// Local: http://localhost:5000
// Vercel: VITE_API_URL from Vercel Environment Variables
// ============================================================

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [view, setView] = useState("participant");

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [prompt, setPrompt] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [eventName, setEventName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [topN, setTopN] = useState(5);

  const [adminEvent, setAdminEvent] = useState(null);
  const [ranking, setRanking] = useState([]);

  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");

  const [stats, setStats] = useState({
    participants: 0,
    judged: 0,
    finalists: 0,
  });

  // ============================================================
  // LOAD LATEST OPEN EVENT
  // ============================================================

  const loadLatestEvent = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setEvent(data || null);
    } catch (error) {
      console.error("LOAD EVENT ERROR:", error);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LOAD ADMIN DATA
  // ============================================================

  const loadAdminData = async () => {
    try {
      setAdminLoading(true);
      setAdminError("");

      const response = await fetch(
        `${API_URL}/api/latest-event`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load event."
        );
      }

      const latestEvent = data.event;

      setAdminEvent(latestEvent);

      if (!latestEvent) {
        setRanking([]);

        setStats({
          participants: 0,
          judged: 0,
          finalists: 0,
        });

        return;
      }

      // ========================================================
      // RESULTS
      // ========================================================

      if (latestEvent.status === "results") {
        const leaderboardResponse = await fetch(
          `${API_URL}/api/leaderboard/${latestEvent.id}`
        );

        const leaderboardData =
          await leaderboardResponse.json();

        if (
          leaderboardResponse.ok &&
          leaderboardData.success
        ) {
          const rows = leaderboardData.ranking || [];

          setRanking(rows);

          setStats({
            participants: rows.length,
            judged: rows.length,
            finalists: Math.min(
              Number(latestEvent.top_n) || 0,
              rows.length
            ),
          });
        }
      } else {
        // ======================================================
        // PARTICIPANT COUNT
        // ======================================================

        const { count: participantCount } = await supabase
          .from("participants")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("event_id", latestEvent.id);

        // ======================================================
        // JUDGED COUNT
        // ======================================================

        const { count: judgedCount } = await supabase
          .from("submissions")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("event_id", latestEvent.id)
          .eq("judged", true);

        setStats({
          participants: participantCount || 0,
          judged: judgedCount || 0,
          finalists: 0,
        });

        setRanking([]);
      }
    } catch (error) {
      console.error("ADMIN LOAD ERROR:", error);

      setAdminError(
        error.message || "Unable to load admin data."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadLatestEvent();
  }, []);

  // ============================================================
  // ADMIN VIEW LOAD
  // ============================================================

  useEffect(() => {
    if (view === "admin") {
      loadAdminData();
    }
  }, [view]);

  // ============================================================
  // PARTICIPANT SUBMIT
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitMessage("");
    setSubmitError("");

    if (!event) {
      setSubmitError("No active event found.");
      return;
    }

    if (event.status !== "open") {
      setSubmitError(
        "Submissions are currently closed."
      );
      return;
    }

    if (!name.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }

    if (!college.trim()) {
      setSubmitError(
        "Please enter your college name."
      );
      return;
    }

    if (!prompt.trim()) {
      setSubmitError(
        "Please enter your image-generation prompt."
      );
      return;
    }

    try {
      setSubmitLoading(true);

      // ========================================================
      // CREATE PARTICIPANT
      // ========================================================

      const {
        data: participant,
        error: participantError,
      } = await supabase
        .from("participants")
        .insert({
          event_id: event.id,
          name: name.trim(),
          college_name: college.trim(),
        })
        .select()
        .single();

      if (participantError) {
        throw new Error(
          participantError.message
        );
      }

      // ========================================================
      // CREATE SUBMISSION
      // ========================================================

      const { error: submissionError } =
        await supabase
          .from("submissions")
          .insert({
            event_id: event.id,
            participant_id: participant.id,
            prompt: prompt.trim(),
          });

      if (submissionError) {
        throw new Error(
          submissionError.message
        );
      }

      setSubmitMessage(
        "Your prompt has been submitted successfully. Good luck! 🚀"
      );

      setName("");
      setCollege("");
      setPrompt("");
    } catch (error) {
      console.error(
        "SUBMISSION ERROR:",
        error
      );

      setSubmitError(
        error.message ||
          "Unable to submit your prompt."
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  // ============================================================
  // CREATE EVENT
  // ============================================================

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    setAdminError("");
    setAdminMessage("");

    if (!eventName.trim()) {
      setAdminError("Enter an event name.");
      return;
    }

    if (!ingredients.trim()) {
      setAdminError(
        "Enter the 3 challenge ingredients."
      );
      return;
    }

    const finalistCount = Number(topN);

    if (
      !Number.isInteger(finalistCount) ||
      finalistCount < 1
    ) {
      setAdminError(
        "Top N must be at least 1."
      );
      return;
    }

    try {
      setAdminLoading(true);

      const response = await fetch(
        `${API_URL}/api/event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventName: eventName.trim(),
            topN: finalistCount,
            ingredients: ingredients.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Event creation failed."
        );
      }

      setAdminEvent(data.event);

      setEventName("");
      setIngredients("");
      setTopN(5);

      setAdminMessage(
        "Event created and submissions are now OPEN."
      );

      setStats({
        participants: 0,
        judged: 0,
        finalists: 0,
      });

      setRanking([]);

      await loadLatestEvent();
    } catch (error) {
      console.error(
        "CREATE EVENT ERROR:",
        error
      );

      setAdminError(
        error.message ||
          "Unable to create event."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // ============================================================
  // DELETE EVENT
  // ============================================================

  const handleDeleteEvent = async () => {
    if (!adminEvent) return;

    const confirmed = window.confirm(
      `Delete "${adminEvent.event_name}"?\n\n` +
        `This will permanently delete the event, participants, submissions, and results.\n\n` +
        `You can then create a new event.`
    );

    if (!confirmed) return;

    try {
      setAdminLoading(true);
      setAdminError("");
      setAdminMessage("");

      const response = await fetch(
        `${API_URL}/api/event/${adminEvent.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to delete event."
        );
      }

      setAdminEvent(null);
      setEvent(null);
      setRanking([]);

      setStats({
        participants: 0,
        judged: 0,
        finalists: 0,
      });

      setAdminMessage(
        "Event deleted successfully. You can create a new event now."
      );

      await loadLatestEvent();
    } catch (error) {
      console.error(
        "DELETE EVENT ERROR:",
        error
      );

      setAdminError(
        error.message ||
          "Unable to delete event."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // ============================================================
  // CLOSE EVENT
  // ============================================================

  const handleCloseEvent = async () => {
    if (!adminEvent) return;

    const confirmed = window.confirm(
      "Close participant submissions?\n\nParticipants will no longer be able to submit."
    );

    if (!confirmed) {
      return;
    }

    try {
      setAdminLoading(true);
      setAdminError("");
      setAdminMessage("");

      const response = await fetch(
        `${API_URL}/api/close-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId: adminEvent.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to close event."
        );
      }

      setAdminEvent(data.event);

      setAdminMessage(
        "Submissions closed. You can now start AI judging."
      );

      await loadLatestEvent();
      await loadAdminData();
    } catch (error) {
      console.error(
        "CLOSE EVENT ERROR:",
        error
      );

      setAdminError(
        error.message ||
          "Unable to close event."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // ============================================================
  // START AI JUDGING
  // ============================================================

  const handleJudge = async () => {
    if (!adminEvent) return;

    const confirmed = window.confirm(
      "Start AI judging?\n\nGemini will evaluate every submitted prompt."
    );

    if (!confirmed) {
      return;
    }

    try {
      setAdminLoading(true);
      setAdminError("");
      setAdminMessage("");

      const response = await fetch(
        `${API_URL}/api/judge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId: adminEvent.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "AI judging failed."
        );
      }

      setRanking(data.ranking || []);

      setStats({
        participants:
          data.totalParticipants || 0,
        judged:
          data.totalParticipants || 0,
        finalists: Math.min(
          data.topN || 0,
          data.totalParticipants || 0
        ),
      });

      setAdminEvent({
        ...adminEvent,
        status: "results",
      });

      setAdminMessage(
        "AI judging completed. Leaderboard is ready! 🏆"
      );

      await loadLatestEvent();
    } catch (error) {
      console.error(
        "AI JUDGE ERROR:",
        error
      );

      setAdminError(
        error.message ||
          "AI judging failed."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // ============================================================
  // REFRESH
  // ============================================================

  const handleRefresh = async () => {
    if (view === "participant") {
      await loadLatestEvent();
    } else {
      await loadAdminData();
    }
  };

  // ============================================================
  // STATUS LABEL
  // ============================================================

  const statusLabel = (status) => {
    if (status === "open")
      return "SUBMISSIONS OPEN";

    if (status === "closed")
      return "SUBMISSIONS CLOSED";

    if (status === "results")
      return "RESULTS READY";

    return "DRAFT";
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app">
      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <nav className="navbar">
        <div className="logo">
          <Sparkles size={22} />
          AI PROMPT BATTLE
        </div>

        <div className="nav-buttons">
          <button
            className={
              view === "participant"
                ? "active"
                : ""
            }
            onClick={() => {
              setView("participant");
              setSubmitError("");
              setSubmitMessage("");
            }}
          >
            <User size={14} />
            PARTICIPANT
          </button>

          <button
            className={
              view === "admin"
                ? "active"
                : ""
            }
            onClick={() => {
              setView("admin");
              setAdminError("");
              setAdminMessage("");
            }}
          >
            <ShieldCheck size={14} />
            ADMIN
          </button>
        </div>
      </nav>

      {/* ======================================================
          PARTICIPANT
      ====================================================== */}

      {view === "participant" && (
        <main className="page">
          <section className="hero">
            <div className="badge">
              <Sparkles size={13} />
              SINGLE ROUND • IMAGE PROMPT BATTLE
            </div>

            <h1>
              PROMPT
              <br />
              <span>BATTLE</span>
            </h1>

            <p>
              Transform three ingredients into one
              powerful image-generation prompt.
              Let AI judge the creativity.
            </p>
          </section>

          {loading ? (
            <div className="center">
              <Loader2
                className="spin"
                size={25}
              />
              Loading event...
            </div>
          ) : !event ? (
            <div className="closed-card">
              <Lock size={45} />

              <h2>No Active Event</h2>

              <p>
                The admin has not created an
                event yet.
              </p>
            </div>
          ) : event.status !== "open" ? (
            <div className="closed-card">
              <Lock size={45} />

              <h2>
                {event.status === "results"
                  ? "Event Completed"
                  : "Submissions Closed"}
              </h2>

              <p>
                {event.status === "results"
                  ? "The AI judging process has been completed."
                  : "The admin has closed participant submissions."}
              </p>

              <button
                className="secondary-button"
                onClick={handleRefresh}
              >
                <RefreshCw size={15} />
                CHECK AGAIN
              </button>
            </div>
          ) : (
            <section className="card">
              {/* EVENT HEADER */}

              <div className="card-header">
                <div>
                  <span className="label">
                    ACTIVE EVENT
                  </span>

                  <h2>
                    {event.event_name}
                  </h2>
                </div>

                <div className="live">
                  LIVE
                </div>
              </div>

              {/* INGREDIENTS */}

              <div className="ingredients">
                <span className="label">
                  YOUR THREE INGREDIENTS
                </span>

                <div className="ingredient-box">
                  {event.ingredients}
                </div>
              </div>

              {/* RULES */}

              <div className="rules">
                <div>
                  <Target size={15} />
                  Use all three ingredients
                  meaningfully.
                </div>

                <div>
                  <Wand2 size={15} />
                  Submit only your final
                  image-generation prompt.
                </div>

                <div>
                  <BrainCircuit size={15} />
                  Gemini AI will judge every
                  submitted prompt.
                </div>

                <div>
                  <ClipboardList size={15} />
                  No generated image upload
                  is required.
                </div>
              </div>

              {/* FORM */}

              <form
                className="form"
                onSubmit={handleSubmit}
              >
                <input
                  type="text"
                  placeholder="Participant Name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  maxLength={100}
                />

                <input
                  type="text"
                  placeholder="College Name"
                  value={college}
                  onChange={(e) =>
                    setCollege(
                      e.target.value
                    )
                  }
                  maxLength={150}
                />

                <textarea
                  placeholder="Paste your final image-generation prompt here..."
                  value={prompt}
                  onChange={(e) =>
                    setPrompt(
                      e.target.value
                    )
                  }
                  maxLength={10000}
                />

                <button
                  type="submit"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Loader2
                        className="spin"
                        size={17}
                      />
                      SUBMITTING...
                    </>
                  ) : (
                    <>
                      <Send size={17} />
                      SUBMIT PROMPT
                    </>
                  )}
                </button>
              </form>

              {/* SUCCESS */}

              {submitMessage && (
                <div className="success">
                  <CheckCircle2 size={17} />
                  {submitMessage}
                </div>
              )}

              {/* ERROR */}

              {submitError && (
                <div className="error">
                  <AlertCircle size={17} />
                  {submitError}
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* ======================================================
          ADMIN
      ====================================================== */}

      {view === "admin" && (
        <main className="admin-page">
          <div className="admin-header">
            <ShieldCheck size={34} />

            <div>
              <span className="label">
                CONTROL CENTER
              </span>

              <h1>ADMIN DASHBOARD</h1>
            </div>

            <p>
              AI-powered single-round
              <br />
              image prompt judging
            </p>
          </div>

          {/* ADMIN ERROR */}

          {adminError && (
            <div className="error admin-message">
              <AlertCircle size={17} />
              {adminError}
            </div>
          )}

          {/* ADMIN SUCCESS */}

          {adminMessage && (
            <div className="success admin-message">
              <CheckCircle2 size={17} />
              {adminMessage}
            </div>
          )}

          {/* ==================================================
              CREATE EVENT
          ================================================== */}

          {!adminEvent && (
            <section className="card">
              <div className="section-title">
                <Play size={18} />
                CREATE NEW EVENT
              </div>

              <form
                onSubmit={handleCreateEvent}
              >
                <input
                  type="text"
                  placeholder="Event Name"
                  value={eventName}
                  onChange={(e) =>
                    setEventName(
                      e.target.value
                    )
                  }
                  maxLength={150}
                />

                <textarea
                  placeholder={
                    "Enter the 3 ingredients.\nExample: astronaut, ancient temple, rain"
                  }
                  value={ingredients}
                  onChange={(e) =>
                    setIngredients(
                      e.target.value
                    )
                  }
                  maxLength={1000}
                />

                <input
                  type="number"
                  min="1"
                  value={topN}
                  onChange={(e) =>
                    setTopN(e.target.value)
                  }
                  placeholder="Top N Finalists"
                />

                <button
                  type="submit"
                  disabled={adminLoading}
                >
                  {adminLoading ? (
                    <>
                      <Loader2
                        className="spin"
                        size={17}
                      />
                      CREATING...
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} />
                      CREATE & OPEN EVENT
                    </>
                  )}
                </button>
              </form>
            </section>
          )}

          {/* ==================================================
              CURRENT EVENT
          ================================================== */}

          {adminEvent && (
            <>
              <div className="event-card">
                <div>
                  <span className="label">
                    CURRENT EVENT
                  </span>

                  <h2>
                    {adminEvent.event_name}
                  </h2>
                </div>

                <div className="event-card-actions">
                  <div
                    className={`status ${
                      adminEvent.status ||
                      "draft"
                    }`}
                  >
                    {statusLabel(
                      adminEvent.status
                    )}
                  </div>

                  <button
                    type="button"
                    className="delete-event-button"
                    onClick={
                      handleDeleteEvent
                    }
                    disabled={adminLoading}
                  >
                    {adminLoading ? (
                      <Loader2
                        className="spin"
                        size={16}
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}

                    DELETE EVENT
                  </button>
                </div>
              </div>

              {/* ==================================================
                  STATS
              ================================================== */}

              <div className="dashboard-grid">
                <div className="stat">
                  <Users size={20} />

                  <span className="label">
                    PARTICIPANTS
                  </span>

                  <strong>
                    {stats.participants}
                  </strong>
                </div>

                <div className="stat">
                  <BrainCircuit size={20} />

                  <span className="label">
                    AI JUDGED
                  </span>

                  <strong>
                    {stats.judged}
                  </strong>
                </div>

                <div className="stat">
                  <Trophy size={20} />

                  <span className="label">
                    TOP FINALISTS
                  </span>

                  <strong>
                    {adminEvent.status ===
                    "results"
                      ? stats.finalists
                      : adminEvent.top_n}
                  </strong>
                </div>
              </div>

              {/* ==================================================
                  INGREDIENTS
              ================================================== */}

              <section className="card admin-ingredients-card">
                <div className="section-title">
                  <Target size={18} />
                  CHALLENGE INGREDIENTS
                </div>

                <div className="ingredient-box">
                  {adminEvent.ingredients}
                </div>
              </section>

              {/* ==================================================
                  CLOSE SUBMISSIONS
              ================================================== */}

              {adminEvent.status ===
                "open" && (
                <section className="admin-actions">
                  <button
                    className="danger-button"
                    onClick={
                      handleCloseEvent
                    }
                    disabled={adminLoading}
                  >
                    {adminLoading ? (
                      <Loader2
                        className="spin"
                        size={17}
                      />
                    ) : (
                      <Lock size={17} />
                    )}

                    CLOSE SUBMISSIONS
                  </button>
                </section>
              )}

              {/* ==================================================
                  AI JUDGE
              ================================================== */}

              {adminEvent.status ===
                "closed" && (
                <section className="judge-launch">
                  <BrainCircuit size={34} />

                  <div>
                    <h2>
                      READY FOR AI JUDGING
                    </h2>

                    <p>
                      Gemini will evaluate
                      every submitted prompt
                      using the fixed
                      100-point judging
                      rubric.
                    </p>
                  </div>

                  <button
                    onClick={handleJudge}
                    disabled={adminLoading}
                  >
                    {adminLoading ? (
                      <>
                        <Loader2
                          className="spin"
                          size={17}
                        />
                        JUDGING...
                      </>
                    ) : (
                      <>
                        <BrainCircuit
                          size={17}
                        />
                        START AI JUDGE
                      </>
                    )}
                  </button>
                </section>
              )}

              {/* ==================================================
                  LEADERBOARD
              ================================================== */}

              {adminEvent.status ===
                "results" &&
                ranking.length > 0 && (
                  <section className="results-section">
                    <div className="results-title">
                      <div>
                        <span className="label">
                          FINAL RESULTS
                        </span>

                        <h2>
                          <Trophy size={22} />
                          LEADERBOARD
                        </h2>
                      </div>

                      <div className="finalist-count">
                        TOP{" "}
                        {adminEvent.top_n}
                      </div>
                    </div>

                    <div className="ranking-list">
                      {ranking.map(
                        (
                          item,
                          index
                        ) => {
                          const participant =
                            item.participants ||
                            {};

                          const isFinalist =
                            index <
                            Number(
                              adminEvent.top_n
                            );

                          return (
                            <div
                              className={`rank-row ${
                                isFinalist
                                  ? "finalist"
                                  : ""
                              }`}
                              key={
                                item.id ||
                                index
                              }
                            >
                              <div className="rank-number">
                                {item.rank ||
                                  index +
                                    1}
                              </div>

                              <div className="participant-info">
                                <strong>
                                  {participant.name ||
                                    item.participantName ||
                                    "Participant"}
                                </strong>

                                <span>
                                  {participant.college_name ||
                                    item.collegeName ||
                                    ""}
                                </span>

                                {isFinalist && (
                                  <small>
                                    <Medal
                                      size={
                                        12
                                      }
                                    />
                                    FINALIST
                                  </small>
                                )}
                              </div>

                              <div className="score">
                                <strong>
                                  {Number(
                                    item.ai_score ??
                                      item.score ??
                                      0
                                  )}
                                </strong>

                                <span>
                                  /100
                                </span>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </section>
                )}
            </>
          )}

          {/* ==================================================
              LOADING
          ================================================== */}

          {adminLoading &&
            !adminEvent && (
              <div className="center">
                <Loader2
                  className="spin"
                  size={25}
                />
                Loading...
              </div>
            )}

          {/* ==================================================
              REFRESH
          ================================================== */}

          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={adminLoading}
          >
            <RefreshCw
              size={15}
              className={
                adminLoading
                  ? "spin"
                  : ""
              }
            />

            REFRESH DASHBOARD
          </button>
        </main>
      )}
    </div>
  );
}

export default App;
