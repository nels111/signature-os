"use client";

import { useEffect, useRef, useState } from "react";

// ---- Types ----
interface QuoteResult {
  success: boolean;
  quote_id: string;
  quote_ref: string;
  pricing: {
    perVisit: number;
    pilotPerVisit: number | null;
    weeklyCharge: number;
    monthlyTotal: number;
    annualTotal: number;
    margin: number;
  };
  email: {
    subject: string;
    html: string;
    to: string;
    pdfFilename: string;
  };
}

// ---- Quote Form HTML (same as before, ported from Vercel) ----
const QUOTE_HTML = `
<style>
  .qg-wrap * { margin: 0; padding: 0; box-sizing: border-box; }
  .qg-wrap {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #333;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    background: #f5f7f5;
    min-height: 100%;
  }

  .qg-wrap .section {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .qg-wrap .section-title {
    font-size: 15px;
    font-weight: 700;
    color: #2c5f2d;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e8f0e8;
  }

  .qg-wrap .field { margin-bottom: 16px; }
  .qg-wrap .field:last-child { margin-bottom: 0; }
  .qg-wrap label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #555;
    margin-bottom: 6px;
  }
  .qg-wrap label .required { color: #c4302b; }

  .qg-wrap input[type="text"],
  .qg-wrap input[type="email"],
  .qg-wrap input[type="tel"],
  .qg-wrap input[type="number"],
  .qg-wrap select {
    width: 100%;
    padding: 12px 14px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.2s;
    background: white;
    -webkit-appearance: none;
  }
  .qg-wrap input:focus, .qg-wrap select:focus {
    border-color: #2c5f2d;
    outline: none;
    box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.1);
  }

  .qg-wrap .days-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .qg-wrap .day-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 4px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }
  .qg-wrap .day-btn.active {
    background: #2c5f2d;
    color: white;
    border-color: #2c5f2d;
  }

  .qg-wrap .pilot-toggle {
    background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
    border: 2px solid #ffc107;
    border-radius: 10px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }
  .qg-wrap .pilot-toggle .toggle-track {
    width: 48px; height: 28px;
    background: #ccc;
    border-radius: 14px;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .qg-wrap .pilot-toggle.active .toggle-track { background: #ffc107; }
  .qg-wrap .toggle-track::after {
    content: '';
    width: 24px; height: 24px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 2px; left: 2px;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .qg-wrap .pilot-toggle.active .toggle-track::after { transform: translateX(20px); }
  .qg-wrap .pilot-info { flex: 1; }
  .qg-wrap .pilot-info strong { color: #856404; font-size: 14px; }
  .qg-wrap .pilot-info span { display: block; font-size: 12px; color: #856404; opacity: 0.8; }

  .qg-wrap .calc-card {
    background: linear-gradient(135deg, #2c5f2d 0%, #1e4520 100%);
    border-radius: 12px;
    padding: 20px;
    color: white;
  }
  .qg-wrap .calc-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; margin-bottom: 4px; }
  .qg-wrap .calc-price { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
  .qg-wrap .calc-subtitle { font-size: 13px; opacity: 0.7; }
  .qg-wrap .calc-pilot {
    background: rgba(255,193,7,0.15);
    border: 1px solid rgba(255,193,7,0.3);
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
  }
  .qg-wrap .calc-pilot .pilot-label { font-size: 11px; color: #ffc107; text-transform: uppercase; letter-spacing: 1px; }
  .qg-wrap .calc-pilot .pilot-price { font-size: 28px; font-weight: 800; color: #ffc107; }
  .qg-wrap .calc-pilot .pilot-save { font-size: 12px; color: #ffc107; opacity: 0.8; }

  .qg-wrap .calc-breakdown { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2); }
  .qg-wrap .calc-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; opacity: 0.85; }
  .qg-wrap .calc-row.highlight { opacity: 1; font-weight: 700; font-size: 14px; padding-top: 8px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.15); }

  .qg-wrap .submit-btn {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #2c5f2d 0%, #1e4520 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(44, 95, 45, 0.3);
  }
  .qg-wrap .submit-btn:active { transform: scale(0.98); }
  .qg-wrap .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .qg-wrap .status-screen { display: none; text-align: center; padding: 40px 20px; }
  .qg-wrap .status-screen.visible { display: block; }
  .qg-wrap .status-icon { font-size: 64px; margin-bottom: 16px; }
  .qg-wrap .status-title { font-size: 22px; font-weight: 700; color: #2c5f2d; margin-bottom: 8px; }
  .qg-wrap .status-text { font-size: 15px; color: #666; margin-bottom: 24px; }
  .qg-wrap .status-ref { background: #e8f0e8; padding: 8px 16px; border-radius: 8px; display: inline-block; font-family: monospace; font-size: 14px; color: #2c5f2d; }
  .qg-wrap .reset-btn { margin-top: 24px; padding: 12px 32px; background: white; color: #2c5f2d; border: 2px solid #2c5f2d; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .qg-wrap .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 12px; color: #991b1b; font-size: 13px; display: none; }
  .qg-wrap #form-container.hidden { display: none; }
  .qg-wrap .spinner { width: 48px; height: 48px; border: 4px solid #e0e0e0; border-top-color: #2c5f2d; border-radius: 50%; animation: qg-spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes qg-spin { to { transform: rotate(360deg); } }
</style>

<div class="qg-wrap">
  <div id="form-container">
    <form id="quote-form">
      <div class="section">
        <div class="section-title">Client Details</div>
        <div class="field"><label>Company Name <span class="required">*</span></label><input type="text" name="company_name" required autocomplete="organization"></div>
        <div class="field"><label>Address <span class="required">*</span></label><input type="text" name="address" required autocomplete="street-address"></div>
        <div class="field"><label>Contact Name <span class="required">*</span></label><input type="text" name="contact_name" required autocomplete="name"></div>
        <div class="field"><label>Contact Email <span class="required">*</span></label><input type="email" name="contact_email" required autocomplete="email"></div>
        <div class="field"><label>Contact Phone</label><input type="tel" name="contact_phone" autocomplete="tel"></div>
      </div>

      <div class="section">
        <div class="section-title">Service Details</div>
        <div class="field">
          <label>Site Type <span class="required">*</span></label>
          <select name="site_type" required>
            <option value="">Select site type...</option>
            <option value="Office/Commercial">Office / Commercial</option>
            <option value="Welfare/Construction">Welfare / Construction</option>
            <option value="Hospitality/Venue">Hospitality / Venue</option>
            <option value="Education/Institutional">Education / Institutional</option>
            <option value="Specialist/Industrial">Specialist / Industrial</option>
            <option value="Dental/Medical">Dental / Medical</option>
          </select>
        </div>
        <div class="field"><label>Hours Per Day <span class="required">*</span></label><input type="number" name="hours_per_day" required min="0.5" max="24" step="0.5" inputmode="decimal"></div>
        <div class="field">
          <label>Frequency Per Week <span class="required">*</span></label>
          <select name="frequency" required>
            <option value="">Select...</option>
            <option value="1">1</option><option value="2">2</option><option value="3">3</option>
            <option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option>
          </select>
        </div>
        <div class="field">
          <label>On Which Days? <span class="required">*</span></label>
          <div class="days-grid">
            <div class="day-btn" data-day="Monday">Mon</div>
            <div class="day-btn" data-day="Tuesday">Tue</div>
            <div class="day-btn" data-day="Wednesday">Wed</div>
            <div class="day-btn" data-day="Thursday">Thu</div>
            <div class="day-btn" data-day="Friday">Fri</div>
            <div class="day-btn" data-day="Saturday">Sat</div>
            <div class="day-btn" data-day="Sunday">Sun</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Pricing</div>
        <div class="field"><label>Margin % <span class="required">*</span></label><input type="number" name="margin" required min="1" max="80" step="1" value="40" inputmode="numeric"></div>
        <div class="field"><label>Product Cost (Weekly) <span class="required">*</span></label><input type="number" name="product_cost" required min="0" step="0.01" value="0" inputmode="decimal"></div>
        <div class="field"><label>Overhead Cost (Weekly) <span class="required">*</span></label><input type="number" name="overhead_cost" required min="0" step="0.01" value="0" inputmode="decimal"></div>
        <div class="field">
          <div class="pilot-toggle" id="pilot-toggle">
            <div class="toggle-track"></div>
            <div class="pilot-info"><strong>Pilot Pricing</strong><span>25% off for 30 days</span></div>
          </div>
        </div>
      </div>

      <div class="section" style="padding:0;overflow:hidden;">
        <div class="calc-card" id="calc-card">
          <div class="calc-title">Per Visit Rate</div>
          <div class="calc-price" id="calc-pervisit">--</div>
          <div class="calc-subtitle">per visit (excl. VAT) -- client sees this</div>
          <div style="margin-top:8px;opacity:0.7;font-size:13px;">Monthly: <span id="calc-monthly">--</span></div>
          <div class="calc-pilot" id="calc-pilot" style="display:none;">
            <div class="pilot-label">Pilot Rate (30 days)</div>
            <div class="pilot-price" id="calc-pilot-price">--</div>
            <div class="pilot-save" id="calc-pilot-save"></div>
          </div>
          <div class="calc-breakdown">
            <div class="calc-row"><span>Labour (per hr)</span><span>£17.00</span></div>
            <div class="calc-row"><span>Weekly labour</span><span id="calc-labour">£0.00</span></div>
            <div class="calc-row"><span>Weekly products</span><span id="calc-products">£0.00</span></div>
            <div class="calc-row"><span>Weekly overhead</span><span id="calc-overhead">£0.00</span></div>
            <div class="calc-row"><span>Weekly total spend</span><span id="calc-spend">£0.00</span></div>
            <div class="calc-row highlight"><span>Weekly charge</span><span id="calc-weekly">£0.00</span></div>
            <div class="calc-row highlight" style="color:#90ee90;"><span>Weekly profit</span><span id="calc-profit">£0.00</span></div>
            <div class="calc-row" style="opacity:0.6;"><span>Margin</span><span id="calc-margin">40%</span></div>
          </div>
        </div>
      </div>

      <div class="error-box" id="error-box"></div>

      <div class="section" style="background:none;box-shadow:none;padding:0;">
        <button type="submit" class="submit-btn" id="submit-btn">Generate Quote</button>
      </div>
    </form>
  </div>

  <div class="status-screen" id="loading-screen">
    <div class="section">
      <div class="spinner"></div>
      <div class="status-title">Generating Quote...</div>
      <div class="status-text">Creating PDF and preparing email draft.</div>
    </div>
  </div>
</div>
`;

export default function QuotesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<"form" | "loading" | "preview" | "sent" | "error">("form");
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [editableSubject, setEditableSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!containerRef.current || screen !== "form") return;

    const LABOUR_RATE = 17;
    const WEEKS_PER_MONTH = 4.33;
    let pilotActive = false;
    let selectedDays: string[] = [];

    const el = containerRef.current;
    const form = el.querySelector("#quote-form") as HTMLFormElement;
    if (!form) return;

    function getEl(id: string) { return el.querySelector("#" + id) as HTMLElement; }

    // Day toggles
    el.querySelectorAll(".day-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        const day = (btn as HTMLElement).dataset.day || "";
        if (btn.classList.contains("active")) {
          if (!selectedDays.includes(day)) selectedDays.push(day);
        } else {
          selectedDays = selectedDays.filter((d) => d !== day);
        }
      });
    });

    // Pilot toggle
    const pilotToggle = getEl("pilot-toggle");
    if (pilotToggle) {
      pilotToggle.addEventListener("click", () => {
        pilotActive = !pilotActive;
        pilotToggle.classList.toggle("active", pilotActive);
        recalc();
      });
    }

    function recalc() {
      const hours = parseFloat((form.elements.namedItem("hours_per_day") as HTMLInputElement)?.value) || 0;
      const freq = parseInt((form.elements.namedItem("frequency") as HTMLSelectElement)?.value) || 0;
      const margin = (parseFloat((form.elements.namedItem("margin") as HTMLInputElement)?.value) || 0) / 100;
      const products = parseFloat((form.elements.namedItem("product_cost") as HTMLInputElement)?.value) || 0;
      const overhead = parseFloat((form.elements.namedItem("overhead_cost") as HTMLInputElement)?.value) || 0;

      const weeklyLabour = hours * LABOUR_RATE * freq;
      const weeklySpend = weeklyLabour + products + overhead;
      const weeklyCharge = margin < 1 ? weeklySpend / (1 - margin) : 0;
      const monthlyTotal = Math.round(weeklyCharge * WEEKS_PER_MONTH);
      const weeklyProfit = weeklyCharge - weeklySpend;

      const fmt = (n: number) => "\u00A3" + n.toFixed(2);

      getEl("calc-labour").textContent = fmt(weeklyLabour);
      getEl("calc-products").textContent = fmt(products);
      getEl("calc-overhead").textContent = fmt(overhead);
      getEl("calc-spend").textContent = fmt(weeklySpend);
      getEl("calc-weekly").textContent = fmt(weeklyCharge);
      getEl("calc-profit").textContent = fmt(weeklyProfit);
      getEl("calc-margin").textContent = (margin * 100).toFixed(0) + "%";

      const perVisit = freq > 0 ? weeklyCharge / freq : 0;
      getEl("calc-pervisit").textContent = perVisit > 0 ? "\u00A3" + perVisit.toFixed(2) : "--";
      getEl("calc-monthly").textContent = monthlyTotal > 0 ? "\u00A3" + monthlyTotal : "--";

      if (pilotActive && perVisit > 0) {
        const pilotPerVisit = perVisit * 0.75;
        const visitSavings = perVisit - pilotPerVisit;
        getEl("calc-pilot").style.display = "block";
        getEl("calc-pilot-price").textContent = "\u00A3" + pilotPerVisit.toFixed(2) + "/visit";
        getEl("calc-pilot-save").textContent = "Save \u00A3" + visitSavings.toFixed(2) + "/visit for 30 days";
      } else {
        getEl("calc-pilot").style.display = "none";
      }
    }

    ["hours_per_day", "margin", "product_cost", "overhead_cost"].forEach((name) => {
      const input = form.elements.namedItem(name) as HTMLInputElement;
      if (input) input.addEventListener("input", recalc);
    });
    const freqSelect = form.elements.namedItem("frequency") as HTMLSelectElement;
    if (freqSelect) freqSelect.addEventListener("change", recalc);

    function showError(msg: string) {
      const box = getEl("error-box");
      box.textContent = msg;
      box.style.display = "block";
      setTimeout(() => { box.style.display = "none"; }, 4000);
    }

    // Submit handler - now generates draft, not sends
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (selectedDays.length === 0) {
        showError("Please select at least one day.");
        return;
      }

      const data = {
        company_name: (form.elements.namedItem("company_name") as HTMLInputElement).value.trim(),
        address: (form.elements.namedItem("address") as HTMLInputElement).value.trim(),
        contact_name: (form.elements.namedItem("contact_name") as HTMLInputElement).value.trim(),
        contact_email: (form.elements.namedItem("contact_email") as HTMLInputElement).value.trim(),
        contact_phone: (form.elements.namedItem("contact_phone") as HTMLInputElement).value.trim() || "Not provided",
        site_type: (form.elements.namedItem("site_type") as HTMLSelectElement).value,
        hours_per_day: parseFloat((form.elements.namedItem("hours_per_day") as HTMLInputElement).value),
        frequency: parseInt((form.elements.namedItem("frequency") as HTMLSelectElement).value),
        days: selectedDays,
        margin: parseFloat((form.elements.namedItem("margin") as HTMLInputElement).value),
        product_cost: parseFloat((form.elements.namedItem("product_cost") as HTMLInputElement).value) || 0,
        overhead_cost: parseFloat((form.elements.namedItem("overhead_cost") as HTMLInputElement).value) || 0,
        pilot_pricing: pilotActive,
      };

      setScreen("loading");

      try {
        const res = await fetch("/api/quotes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Quote generation failed");

        setQuoteResult(result);
        setEditableSubject(result.email.subject);
        setScreen("preview");
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
        setScreen("error");
      }
    });

    recalc();
  }, [screen]);

  // Send the quote
  const handleSend = async () => {
    if (!quoteResult) return;
    setSending(true);
    setSendError("");

    try {
      const res = await fetch(`/api/quotes/${quoteResult.quote_id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editableSubject,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send");

      setScreen("sent");
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const resetAll = () => {
    setQuoteResult(null);
    setEditableSubject("");
    setSendError("");
    setErrorMessage("");
    setScreen("form");
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      {/* Form Screen */}
      {screen === "form" && (
        <div ref={containerRef} dangerouslySetInnerHTML={{ __html: QUOTE_HTML }} />
      )}

      {/* Loading Screen */}
      {screen === "loading" && (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: 40, textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, border: "4px solid #e0e0e0", borderTopColor: "#2c5f2d",
            borderRadius: "50%", animation: "qg-spin 0.8s linear infinite", margin: "0 auto 16px"
          }} />
          <style>{`@keyframes qg-spin { to { transform: rotate(360deg); } }`}</style>
          <h2 style={{ color: "#2c5f2d", marginBottom: 8 }}>Generating Quote...</h2>
          <p style={{ color: "#666" }}>Creating PDF and preparing email draft.</p>
        </div>
      )}

      {/* Email Preview Screen */}
      {screen === "preview" && quoteResult && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 16, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
          {/* Header bar */}
          <div style={{
            background: "linear-gradient(135deg, #2c5f2d 0%, #1e4520 100%)",
            borderRadius: "12px 12px 0 0", padding: "16px 20px", color: "white",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>Email Draft Preview</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{quoteResult.quote_ref}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={resetAll}
                style={{
                  padding: "8px 16px", background: "rgba(255,255,255,0.15)", color: "white",
                  border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, cursor: "pointer",
                  fontSize: 14, fontWeight: 600
                }}
              >
                Back to Form
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  padding: "8px 24px", background: "#f9a825", color: "#000",
                  border: "none", borderRadius: 8, cursor: sending ? "not-allowed" : "pointer",
                  fontSize: 14, fontWeight: 700, opacity: sending ? 0.6 : 1
                }}
              >
                {sending ? "Sending..." : "Send Quote"}
              </button>
            </div>
          </div>

          {/* Email metadata */}
          <div style={{
            background: "#f8f9fa", padding: "16px 20px", borderBottom: "1px solid #e0e0e0",
            fontSize: 14
          }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "#555", width: 60, display: "inline-block" }}>From:</span>
              <span>Nick Stentiford &lt;nick@signature-cleans.co.uk&gt;</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "#555", width: 60, display: "inline-block" }}>To:</span>
              <span>{quoteResult.email.to}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "#555", width: 60, display: "inline-block" }}>Subject:</span>
              <input
                type="text"
                value={editableSubject}
                onChange={(e) => setEditableSubject(e.target.value)}
                style={{
                  border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px",
                  fontSize: 14, width: "calc(100% - 70px)", fontFamily: "inherit"
                }}
              />
            </div>
            <div>
              <span style={{ fontWeight: 600, color: "#555", width: 60, display: "inline-block" }}>Attach:</span>
              <span style={{
                background: "#e8f0e8", padding: "2px 8px", borderRadius: 4,
                fontSize: 13, color: "#2c5f2d"
              }}>
                📎 {quoteResult.email.pdfFilename}
              </span>
            </div>
          </div>

          {/* Pricing summary bar */}
          <div style={{
            background: "#fff", padding: "12px 20px", borderBottom: "1px solid #e0e0e0",
            display: "flex", gap: 24, fontSize: 13, color: "#555"
          }}>
            <span><strong>Per Visit:</strong> £{quoteResult.pricing.perVisit.toFixed(2)}</span>
            {quoteResult.pricing.pilotPerVisit && (
              <span><strong>Pilot:</strong> £{quoteResult.pricing.pilotPerVisit.toFixed(2)}</span>
            )}
            <span><strong>Monthly:</strong> £{quoteResult.pricing.monthlyTotal.toFixed(2)}</span>
            <span><strong>Annual:</strong> £{quoteResult.pricing.annualTotal.toFixed(2)}</span>
            <span><strong>Margin:</strong> {quoteResult.pricing.margin.toFixed(0)}%</span>
          </div>

          {sendError && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 20px",
              color: "#991b1b", fontSize: 14
            }}>
              {sendError}
            </div>
          )}

          {/* Email HTML preview */}
          <div style={{
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: "0 0 12px 12px",
            overflow: "hidden"
          }}>
            <iframe
              srcDoc={quoteResult.email.html}
              style={{ width: "100%", height: 700, border: "none" }}
              title="Email Preview"
              sandbox=""
            />
          </div>
        </div>
      )}

      {/* Sent Success Screen */}
      {screen === "sent" && quoteResult && (
        <div style={{
          maxWidth: 500, margin: "80px auto", padding: 40, textAlign: "center",
          background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
          <h2 style={{ color: "#2c5f2d", marginBottom: 8 }}>Quote Sent!</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>
            Quote emailed to {quoteResult.email.to} with PDF attached.
          </p>
          <div style={{
            background: "#e8f0e8", padding: "8px 16px", borderRadius: 8,
            display: "inline-block", fontFamily: "monospace", fontSize: 14, color: "#2c5f2d"
          }}>
            {quoteResult.quote_ref}
          </div>
          <br />
          <button
            onClick={resetAll}
            style={{
              marginTop: 24, padding: "12px 32px", background: "white", color: "#2c5f2d",
              border: "2px solid #2c5f2d", borderRadius: 8, fontSize: 15,
              fontWeight: 600, cursor: "pointer"
            }}
          >
            New Quote
          </button>
        </div>
      )}

      {/* Error Screen */}
      {screen === "error" && (
        <div style={{
          maxWidth: 500, margin: "80px auto", padding: 40, textAlign: "center",
          background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚠</div>
          <h2 style={{ color: "#c4302b", marginBottom: 8 }}>Something Went Wrong</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>{errorMessage}</p>
          <button
            onClick={resetAll}
            style={{
              marginTop: 8, padding: "12px 32px", background: "white", color: "#2c5f2d",
              border: "2px solid #2c5f2d", borderRadius: 8, fontSize: 15,
              fontWeight: 600, cursor: "pointer"
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
