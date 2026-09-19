import type { MaterialPassport } from "@/types";

/**
 * Generates an official, printable HTML/PDF Digital Material Passport
 */
export function generatePassportHTML(passport: MaterialPassport): string {
  const generatedAt = new Date(passport.generated_at).toLocaleString();
  
  const itemsRows = passport.material_summary.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${item.category.replace(/_/g, " ").toUpperCase()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.condition || "Unknown"}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.battery_present ? "⚡ Yes (Li-ion)" : "No"}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.components.join(", ") || "N/A"}</td>
      </tr>
    `
    )
    .join("");

  const hazardsRows = passport.ai_understanding.hazard_signals
    .map(
      (sig) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #dc2626; font-weight: 600;">⚠️ ${sig.type.replace(/_/g, " ").toUpperCase()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${sig.severity ? sig.severity.toUpperCase() : "MEDIUM"}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${(sig.confidence * 100).toFixed(0)}%</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${sig.verification_status.toUpperCase()}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Material Passport - ${passport.passport_id}</title>
  <style>
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #16a34a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
    .badge {
      background: #dcfce7;
      color: #15803d;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
    .card-value { font-size: 16px; font-weight: 600; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
    th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }
    .footer { margin-top: 40px; pt: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
    .btn-print {
      background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px;
      font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="no-print" style="text-align: right;">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <div class="header">
      <div>
        <h1 class="title">♻️ ReRoute Digital Material Passport</h1>
        <div class="subtitle">Official EU WEEE & E-Waste Circular Compliance Document</div>
      </div>
      <div class="badge">${passport.current_status.toUpperCase()}</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Passport ID</div>
        <div class="card-value">${passport.passport_id}</div>
      </div>
      <div class="card">
        <div class="card-title">Lot Reference</div>
        <div class="card-value">${passport.lot_id}</div>
      </div>
      <div class="card">
        <div class="card-title">Generated Timestamp</div>
        <div class="card-value">${generatedAt}</div>
      </div>
      <div class="card">
        <div class="card-title">Destination Facility</div>
        <div class="card-value">${passport.routing.recommended_facility_name || "Pending Allocation"}</div>
      </div>
    </div>

    <h2 style="font-size: 18px; margin-top: 30px;">📦 Identified Material Inventory (${passport.material_summary.total_items} items)</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align: center;">Qty</th>
          <th>Condition</th>
          <th style="text-align: center;">Battery Present</th>
          <th>Components</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || "<tr><td colspan='5' style='text-align:center; padding:20px; color:#94a3b8;'>No material items registered</td></tr>"}
      </tbody>
    </table>

    ${
      hazardsRows
        ? `
      <h2 style="font-size: 18px; margin-top: 30px; color: #dc2626;">⚠️ Hazard & Toxicity Signals</h2>
      <table>
        <thead>
          <tr>
            <th>Signal Type</th>
            <th>Severity</th>
            <th>AI Confidence</th>
            <th>Verification Status</th>
          </tr>
        </thead>
        <tbody>
          ${hazardsRows}
        </tbody>
      </table>
    `
        : ""
    }

    <div class="footer">
      <p>Verified by ReRoute AI Engine (AWS Bedrock) & Circular Compliance Protocol.</p>
      <p>Security Hash: <code>${passport.passport_id}-${Date.now()}</code></p>
    </div>
  </div>
</body>
</html>
  `;
}
