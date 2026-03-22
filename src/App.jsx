import { useState, useCallback } from "react";

const CITIES = {
  nyc: { name: "New York City", state: "NY", stateTax: 0.0685, cityTax: 0.03876, car: false, groceries: 400, transport: 130, utilities: 120, phone: 80 },
  sf:  { name: "San Francisco", state: "CA", stateTax: 0.093,  cityTax: 0,       car: false, groceries: 380, transport: 110, utilities: 110, phone: 80 },
  sea: { name: "Seattle",       state: "WA", stateTax: 0,       cityTax: 0,       car: false, groceries: 350, transport: 100, utilities: 100, phone: 80 },
  atl: { name: "Atlanta",       state: "GA", stateTax: 0.055,   cityTax: 0,       car: true,  groceries: 300, transport: 580, utilities: 110, phone: 80 },
  clt: { name: "Charlotte",     state: "NC", stateTax: 0.0525,  cityTax: 0,       car: true,  groceries: 280, transport: 560, utilities: 100, phone: 80 },
};

const FED_BRACKETS = [
  { limit: 11925,    rate: 0.10 },
  { limit: 48475,    rate: 0.12 },
  { limit: 103350,   rate: 0.22 },
  { limit: 197300,   rate: 0.24 },
  { limit: 250525,   rate: 0.32 },
  { limit: 626350,   rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
];

function calcFedTax(income) {
  let tax = 0, prev = 0;
  for (const b of FED_BRACKETS) {
    tax += Math.max(0, Math.min(income, b.limit) - prev) * b.rate;
    prev = b.limit;
    if (income <= b.limit) break;
  }
  return tax;
}

function getMarginalRate(income) {
  for (const b of FED_BRACKETS) if (income <= b.limit) return b.rate;
  return 0.37;
}

function fmt(n) { return "$" + Math.round(Math.abs(n)).toLocaleString(); }
function fmtPct(n) { return Math.round(n) + "%"; }

export default function App() {
  const [screen, setScreen] = useState(1);
  const [salaryType, setSalaryType] = useState("salary");
  const [salary, setSalary] = useState("");
  const [hourly, setHourly] = useState("");
  const [hours, setHours] = useState("40");
  const [city, setCity] = useState(null);
  const [k401Type, setK401Type] = useState("pre");
  const [k401Mode, setK401Mode] = useState("percent");
  const [k401Pct, setK401Pct] = useState("4");
  const [k401Dollar, setK401Dollar] = useState("");
  const [health, setHealth] = useState("150");
  const [hsa, setHsa] = useState("0");
  const [expenses, setExpenses] = useState({});
  const [slider, setSlider] = useState(50);
  const [freq, setFreq] = useState("monthly");
  const [salaryErr, setSalaryErr] = useState("");
  const [cityErr, setCityErr] = useState("");

  const gross = salaryType === "salary"
    ? parseFloat(salary) || 0
    : (parseFloat(hourly) || 0) * (parseFloat(hours) || 40) * 52;

  const k401Monthly = k401Mode === "percent"
    ? gross * ((parseFloat(k401Pct) || 0) / 100) / 12
    : parseFloat(k401Dollar) || 0;

  const healthMonthly = parseFloat(health) || 0;
  const hsaMonthly = parseFloat(hsa) || 0;
  const cityData = city ? CITIES[city] : null;

  const t = useCallback(() => {
    if (!gross || !cityData) return null;
    const k401Pre = k401Type === "pre" ? k401Monthly : 0;
    const pretaxM = k401Pre + healthMonthly + hsaMonthly;
    const pretaxY = pretaxM * 12;
    const taxableY = Math.max(0, gross - pretaxY);
    const fedTax = calcFedTax(taxableY);
    const stateTax = taxableY * (cityData.stateTax + cityData.cityTax);
    const allDeductionsY = (k401Monthly + healthMonthly + hsaMonthly) * 12;
    const takehomeY = gross - allDeductionsY - fedTax - stateTax;
    return {
      grossM: gross / 12,
      pretaxM,
      postTaxK401M: k401Type === "post" ? k401Monthly : 0,
      taxableM: taxableY / 12,
      fedTaxM: fedTax / 12,
      stateTaxM: stateTax / 12,
      takehomeM: takehomeY / 12,
    };
  }, [gross, cityData, k401Type, k401Monthly, healthMonthly, hsaMonthly])();

  const cityExpenses = city ? { groceries: CITIES[city].groceries, transport: CITIES[city].transport, utilities: CITIES[city].utilities, phone: CITIES[city].phone, ...expenses } : {};
  const totalExp = Object.values(cityExpenses).reduce((a, b) => a + b, 0);
  const available = t ? Math.max(0, t.takehomeM - totalExp) : 0;
  const rent = available * (slider / 100);
  const savings = available - rent;
  const savingsRate = t && t.takehomeM > 0 ? (savings / t.takehomeM) * 100 : 0;
  const freqMult = freq === "monthly" ? 1 : freq === "biweekly" ? 12 / 26 : 12;
  const freqLabel = freq === "monthly" ? "/mo" : freq === "biweekly" ? "/paycheck" : "/yr";

  const matchM = Math.min(k401Monthly, gross * 0.04 / 12);
  const emergencyM = Math.min(savings * 0.3, 200);
  const rothM = Math.min(Math.max(0, savings - matchM - emergencyM - hsaMonthly), 625);
  const remainingM = Math.max(0, savings - matchM - emergencyM - hsaMonthly - rothM);
  const r = 0.07 / 12;
  const fv = savings * ((Math.pow(1 + r, 120) - 1) / r);

  function goTo(n) {
    if (n > 1 && !gross) { setSalaryErr("Please enter your salary to continue."); return; }
    setSalaryErr("");
    if (n > 2 && !city) { setCityErr("Please select a city to continue."); return; }
    setCityErr("");
    if (n === 5 && Object.keys(expenses).length === 0 && city) {
      setExpenses({ groceries: cityData.groceries, transport: cityData.transport, utilities: cityData.utilities, phone: cityData.phone });
    }
    setScreen(n);
  }

  function pretaxInsight() {
    if (!k401Monthly) return "Enter your 401K contribution to see the impact on your paycheck.";
    if (k401Type === "post") return `You're contributing ${fmt(k401Monthly)}/mo to a Roth 401K. Post-tax — no break now, but grows and withdraws completely tax-free. Your paycheck drops by the full ${fmt(k401Monthly)}/mo.`;
    const marginal = getMarginalRate(gross) + (cityData ? cityData.stateTax + cityData.cityTax : 0.05);
    const taxSaved = k401Monthly * marginal;
    return `You're contributing ${fmt(k401Monthly)}/mo to a Traditional 401K. Because it's pre-tax, your paycheck only drops by ${fmt(k401Monthly - taxSaved)}/mo. The other ${fmt(taxSaved)}/mo comes from your tax savings.`;
  }

  const bg = "#0f0f0f", surface = "#1a1a1a", surface2 = "#222", border = "#2e2e2e";
  const text = "#f0ede8", muted = "#7a7672", accent = "#c8f06e", info = "#6eb4f0", danger = "#f06e6e";

  const T = {
    wrap: { maxWidth: 480, margin: "0 auto", padding: "0 0 80px", fontFamily: "system-ui, sans-serif", background: bg, minHeight: "100vh", color: text },
    screen: { padding: "52px 24px 24px" },
    chip: { fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 12 },
    h1: { fontSize: 30, fontWeight: 300, lineHeight: 1.2, marginBottom: 8 },
    em: { fontStyle: "italic", color: accent, fontWeight: 400 },
    sub: { fontSize: 14, color: muted, lineHeight: 1.6, marginBottom: 32 },
    lbl: { display: "block", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: muted, marginBottom: 8 },
    field: { marginBottom: 24 },
    iWrap: { position: "relative", display: "flex", alignItems: "center" },
    prefix: { position: "absolute", left: 16, color: muted, fontSize: 18, pointerEvents: "none", zIndex: 1 },
    input: { width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 8, color: text, fontFamily: "inherit", fontSize: 22, fontWeight: 300, padding: "14px 16px 14px 36px", outline: "none" },
    inputPlain: { width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 8, color: text, fontFamily: "inherit", fontSize: 22, fontWeight: 300, padding: "14px 16px", outline: "none" },
    tg: { display: "flex", background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: 4, gap: 4, marginBottom: 16 },
    tb: (a) => ({ flex: 1, padding: "10px 8px", background: a ? accent : "none", border: "none", borderRadius: 6, color: a ? "#0f0f0f" : muted, fontFamily: "inherit", fontSize: 13, fontWeight: a ? 500 : 400, cursor: "pointer" }),
    card: { background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 },
    row: (tot) => ({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${border}`, background: tot ? surface2 : "transparent" }),
    rowL: (tot) => ({ fontSize: 14, color: tot ? text : muted, fontWeight: tot ? 500 : 400 }),
    rowV: (type) => ({ fontSize: 15, color: type === "neg" ? danger : type === "accent" ? accent : type === "info" ? info : text }),
    btn: { display: "block", width: "100%", padding: 18, background: accent, color: "#0f0f0f", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 15, fontWeight: 500, cursor: "pointer", marginTop: 24 },
    ghost: { display: "block", width: "100%", padding: 14, background: "none", color: muted, border: `1px solid ${border}`, borderRadius: 8, fontFamily: "inherit", fontSize: 14, cursor: "pointer", marginTop: 10 },
    callout: { background: "rgba(200,240,110,0.08)", border: "1px solid rgba(200,240,110,0.25)", borderRadius: 8, padding: "16px 18px", marginBottom: 20 },
    cLbl: { fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8aab3e", marginBottom: 6 },
    cTxt: { fontSize: 14, lineHeight: 1.6, color: text },
    cityGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 },
    cityBtn: (sel) => ({ background: sel ? "rgba(200,240,110,0.08)" : surface, border: `1px solid ${sel ? accent : border}`, borderRadius: 8, color: sel ? accent : text, fontFamily: "inherit", padding: "16px 12px", cursor: "pointer", textAlign: "left", width: "100%" }),
    prog: { position: "fixed", top: 0, left: 0, right: 0, height: 3, background: border, zIndex: 100 },
    progFill: (p) => ({ height: "100%", background: accent, width: p + "%", transition: "width 0.4s ease" }),
    splitGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 },
    splitCard: (type) => ({ background: surface, border: `1px solid ${type === "rent" ? info : accent}`, borderRadius: 12, padding: "18px 16px", textAlign: "center" }),
    splitAmt: (type) => ({ fontSize: 26, color: type === "rent" ? info : accent, marginBottom: 4 }),
    banner: { background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "20px 18px", marginBottom: 28 },
    pill: { background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: muted, cursor: "pointer", fontFamily: "inherit" },
    freqBtn: (a) => ({ padding: "6px 14px", background: a ? surface2 : surface, border: `1px solid ${a ? text : border}`, borderRadius: 20, color: a ? text : muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }),
    wfRow: { display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", borderBottom: `1px solid ${border}` },
    wfNum: { width: 24, height: 24, borderRadius: "50%", background: surface2, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: muted, flexShrink: 0, marginTop: 2 },
    statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
    stat: { background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: 16 },
    statV: (c) => ({ fontSize: 26, color: c === "green" ? accent : c === "blue" ? info : text }),
    projCard: { background: "rgba(200,240,110,0.06)", border: "1px solid rgba(200,240,110,0.2)", borderRadius: 12, padding: "20px 18px", marginBottom: 20, textAlign: "center" },
    dot: (pass) => ({ width: 8, height: 8, borderRadius: "50%", background: pass ? accent : danger, flexShrink: 0 }),
    secLabel: { fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: muted, margin: "28px 0 12px" },
    err: { color: danger, fontSize: 13, marginTop: 8 },
  };

  const expItems = cityData ? [
    { key: "groceries", label: "Groceries" },
    { key: "transport", label: cityData.car ? "Car (payment + insurance + gas)" : "Transportation (transit)" },
    { key: "utilities", label: "Utilities" },
    { key: "phone", label: "Phone" },
  ] : [];

  return (
    <div style={T.wrap}>
      <style>{`input[type=range]{-webkit-appearance:none;width:100%;height:4px;background:#2e2e2e;border-radius:2px;outline:none;cursor:pointer}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#c8f06e;border:3px solid #0f0f0f}input:focus{outline:none;border-color:#c8f06e!important}*{box-sizing:border-box}`}</style>
      <div style={T.prog}><div style={T.progFill((screen / 8) * 100)} /></div>

      {screen === 1 && (
        <div style={T.screen}>
          <div style={T.chip}>Step 1 of 8</div>
          <h1 style={T.h1}>Your <em style={T.em}>offer.</em></h1>
          <p style={T.sub}>Enter the salary from your offer letter. This is the starting point for everything.</p>
          <div style={T.tg}>
            <button style={T.tb(salaryType === "salary")} onClick={() => setSalaryType("salary")}>Salaried</button>
            <button style={T.tb(salaryType === "hourly")} onClick={() => setSalaryType("hourly")}>Hourly</button>
          </div>
          {salaryType === "salary" ? (
            <div style={T.field}>
              <label style={T.lbl}>Annual Salary</label>
              <div style={T.iWrap}>
                <span style={T.prefix}>$</span>
                <input style={T.input} type="number" placeholder="65000" value={salary} onChange={e => { setSalary(e.target.value); setSalaryErr(""); }} />
              </div>
            </div>
          ) : (
            <div style={T.field}>
              <label style={T.lbl}>Hourly Rate</label>
              <div style={T.iWrap}><span style={T.prefix}>$</span><input style={T.input} type="number" placeholder="25.00" value={hourly} onChange={e => setHourly(e.target.value)} /></div>
              <div style={{ marginTop: 12 }}>
                <label style={T.lbl}>Hours per week</label>
                <input style={T.inputPlain} type="number" placeholder="40" value={hours} onChange={e => setHours(e.target.value)} />
              </div>
            </div>
          )}
          {salaryErr && <p style={T.err}>{salaryErr}</p>}
          <button style={T.btn} onClick={() => goTo(2)}>Continue →</button>
        </div>
      )}

      {screen === 2 && (
        <div style={T.screen}>
          <div style={T.chip}>Step 2 of 8</div>
          <h1 style={T.h1}>Where are you <em style={T.em}>moving?</em></h1>
          <p style={T.sub}>Your city sets state taxes and cost of living defaults.</p>
          <div style={T.cityGrid}>
            {Object.entries(CITIES).map(([key, c]) => (
              <button key={key} style={{ ...T.cityBtn(city === key), gridColumn: key === "clt" ? "span 2" : undefined }} onClick={() => { setCity(key); setCityErr(""); }}>
                <span style={{ fontWeight: 500, display: "block" }}>{c.name}</span>
                <span style={{ fontSize: 11, color: muted, marginTop: 2, display: "block" }}>{c.car ? "Car required" : "No car needed"}</span>
              </button>
            ))}
          </div>
          {cityErr && <p style={T.err}>{cityErr}</p>}
          <button style={T.btn} onClick={() => goTo(3)}>Continue →</button>
          <button style={T.ghost} onClick={() => goTo(1)}>← Back</button>
        </div>
      )}

      {screen === 3 && (
        <div style={T.screen}>
          <div style={T.chip}>Step 3 of 8</div>
          <h1 style={T.h1}>Before taxes <em style={T.em}>hit.</em></h1>
          <p style={T.sub}>These come out before the government takes their cut — meaning you pay less tax.</p>
          <div style={T.field}>
            <label style={T.lbl}>401K Contribution Type</label>
            <div style={T.tg}>
              <button style={T.tb(k401Type === "pre")} onClick={() => setK401Type("pre")}>Traditional (pre-tax)</button>
              <button style={T.tb(k401Type === "post")} onClick={() => setK401Type("post")}>Roth (post-tax)</button>
            </div>
            <p style={{ fontSize: 12, color: muted, marginBottom: 16, lineHeight: 1.5 }}>
              {k401Type === "pre" ? "Reduces your taxable income now. You pay taxes on withdrawal in retirement." : "No tax break now — but grows and withdraws completely tax-free."}
            </p>
            <label style={T.lbl}>Contribution Amount</label>
            <div style={T.tg}>
              <button style={T.tb(k401Mode === "percent")} onClick={() => setK401Mode("percent")}>% of salary</button>
              <button style={T.tb(k401Mode === "dollar")} onClick={() => setK401Mode("dollar")}>$ / month</button>
            </div>
            {k401Mode === "percent" ? (
              <div style={T.iWrap}>
                <input style={T.inputPlain} type="number" placeholder="4" min="0" max="30" value={k401Pct} onChange={e => setK401Pct(e.target.value)} />
                <span style={{ position: "absolute", right: 16, color: muted, fontSize: 18 }}>%</span>
              </div>
            ) : (
              <div style={T.iWrap}><span style={T.prefix}>$</span><input style={T.input} type="number" placeholder="200" value={k401Dollar} onChange={e => setK401Dollar(e.target.value)} /></div>
            )}
            <p style={{ fontSize: 12, color: muted, marginTop: 6 }}>Default 4% captures a typical employer match.</p>
          </div>
          <div style={T.field}>
            <label style={T.lbl}>Health Insurance Premium</label>
            <div style={T.iWrap}><span style={T.prefix}>$</span><input style={T.input} type="number" placeholder="150" value={health} onChange={e => setHealth(e.target.value)} /></div>
            <p style={{ fontSize: 12, color: muted, marginTop: 6 }}>Monthly premium taken pre-tax from your paycheck.</p>
          </div>
          <div style={T.field}>
            <label style={T.lbl}>HSA Contribution <span style={{ fontWeight: 300 }}>(optional)</span></label>
            <div style={T.iWrap}><span style={T.prefix}>$</span><input style={T.input} type="number" placeholder="0" value={hsa} onChange={e => setHsa(e.target.value)} /></div>
            <p style={{ fontSize: 12, color: muted, marginTop: 6 }}>Health Savings Account — triple tax advantage. 2026 limit: $4,400/yr.</p>
          </div>
          <div style={T.callout}>
            <div style={T.cLbl}>The insight</div>
            <p style={T.cTxt}>{pretaxInsight()}</p>
          </div>
          <button style={T.btn} onClick={() => goTo(4)}>Continue →</button>
          <button style={T.ghost} onClick={() => goTo(2)}>← Back</button>
        </div>
      )}

      {screen === 4 && t && (
        <div style={T.screen}>
          <div style={T.chip}>Step 4 of 8</div>
          <h1 style={T.h1}>Your actual <em style={T.em}>paycheck.</em></h1>
          <p style={T.sub}>What actually lands in your bank account after everything.</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {["monthly", "biweekly", "yearly"].map(f => (
              <button key={f} style={T.freqBtn(freq === f)} onClick={() => setFreq(f)}>
                {f === "biweekly" ? "Bi-weekly" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div style={T.card}>
            {[
              { label: "Gross salary", val: t.grossM * freqMult },
              { label: k401Type === "post" ? "Health + HSA (pre-tax)" : "401K + health + HSA (pre-tax)", val: -(t.pretaxM * freqMult), type: "neg", skip: t.pretaxM === 0 },
              { label: "Taxable income", val: t.taxableM * freqMult },
              { label: "Federal tax (est.)", val: -(t.fedTaxM * freqMult), type: "neg" },
              { label: `${cityData.state} state/city tax`, val: -(t.stateTaxM * freqMult), type: "neg" },
              { label: "Roth 401K (post-tax)", val: -(t.postTaxK401M * freqMult), type: "neg", skip: k401Type !== "post" || t.postTaxK401M === 0 },
              { label: `Take-home ${freqLabel}`, val: t.takehomeM * freqMult, type: "accent", total: true },
            ].filter(r => !r.skip).map((r, i, arr) => (
              <div key={i} style={{ ...T.row(r.total), borderBottom: i === arr.length - 1 ? "none" : `1px solid ${border}` }}>
                <span style={T.rowL(r.total)}>{r.label}</span>
                <span style={T.rowV(r.type)}>{r.val < 0 ? "-" + fmt(-r.val) : fmt(r.val)}</span>
              </div>
            ))}
          </div>
          <div style={T.callout}>
            <div style={T.cLbl}>Why it's lower than your offer</div>
            <p style={T.cTxt}>Pre-tax deductions and taxes bring your take-home to <strong style={{ color: accent }}>{fmt(t.takehomeM)}/mo</strong>. This is what you actually have to work with.</p>
          </div>
          <button style={T.btn} onClick={() => goTo(5)}>Continue →</button>
          <button style={T.ghost} onClick={() => goTo(3)}>← Back</button>
        </div>
      )}

      {screen === 5 && cityData && (
        <div style={T.screen}>
          <div style={T.chip}>Step 5 of 8</div>
          <h1 style={T.h1}>Your <em style={T.em}>floor.</em></h1>
          <p style={T.sub}>Non-negotiables. Edit any number to match your situation.</p>
          <div style={T.card}>
            {expItems.map((item, i) => (
              <div key={item.key} style={{ ...T.row(false), borderBottom: `1px solid ${border}` }}>
                <span style={T.rowL(false)}>{item.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: muted, fontSize: 14 }}>$</span>
                  <input type="number" value={cityExpenses[item.key] || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; setExpenses(ex => ({ ...ex, [item.key]: v })); }}
                    style={{ background: "none", border: "none", borderBottom: `1px solid ${border}`, color: text, fontFamily: "inherit", fontSize: 15, textAlign: "right", width: 80, outline: "none", padding: "2px 0" }} />
                  <span style={{ color: muted, fontSize: 12 }}>/mo</span>
                </div>
              </div>
            ))}
            <div style={{ ...T.row(true), borderBottom: "none" }}>
              <span style={T.rowL(true)}>Total mandatory</span>
              <span style={T.rowV("accent")}>{fmt(totalExp)}/mo</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: muted, textAlign: "center", marginTop: 8 }}>Defaults are estimates for {cityData.name}.</p>
          <button style={T.btn} onClick={() => goTo(6)}>Continue →</button>
          <button style={T.ghost} onClick={() => goTo(4)}>← Back</button>
        </div>
      )}

      {screen === 6 && t && (
        <div style={T.screen}>
          <div style={T.chip}>Step 6 of 8</div>
          <h1 style={T.h1}>The big <em style={T.em}>tradeoff.</em></h1>
          <p style={T.sub}>This is the one real choice you have. Drag to find your balance.</p>
          <div style={T.banner}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: muted, marginBottom: 4 }}>Available for rent + savings</div>
            <div style={{ fontSize: 36, color: accent, fontWeight: 300 }}>{fmt(available)}/mo</div>
            <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>After taxes and mandatory expenses</div>
          </div>
          <div style={T.splitGrid}>
            <div style={T.splitCard("rent")}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: muted, marginBottom: 8 }}>Rent ceiling</div>
              <div style={T.splitAmt("rent")}>{fmt(rent)}/mo</div>
              <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{fmtPct(t.takehomeM > 0 ? (rent / t.takehomeM) * 100 : 0)} of take-home</div>
            </div>
            <div style={T.splitCard("savings")}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: muted, marginBottom: 8 }}>Monthly savings</div>
              <div style={T.splitAmt("savings")}>{fmt(savings)}/mo</div>
              <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{fmtPct(savingsRate)} savings rate</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[["Max savings", 15], ["Balanced", 50], ["Max rent", 78]].map(([label, val]) => (
              <button key={label} style={T.pill} onClick={() => setSlider(val)}>{label}</button>
            ))}
          </div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: muted, marginBottom: 10 }}>
              <span>← more savings</span><span>more rent →</span>
            </div>
            <input type="range" min={10} max={85} value={slider} onChange={e => setSlider(Number(e.target.value))} />
          </div>
          <div style={T.card}>
            {[
              { label: "Rent", val: rent, type: "info" },
              { label: "Mandatory expenses", val: totalExp },
              { label: "Savings", val: savings, type: "accent" },
              { label: "Total = take-home", val: t.takehomeM, type: "accent", total: true },
            ].map((r, i, arr) => (
              <div key={i} style={{ ...T.row(r.total), borderBottom: i === arr.length - 1 ? "none" : `1px solid ${border}` }}>
                <span style={T.rowL(r.total)}>{r.label}</span>
                <span style={T.rowV(r.type)}>{fmt(r.val)}</span>
              </div>
            ))}
          </div>
          <button style={T.btn} onClick={() => goTo(7)}>See where savings go →</button>
          <button style={T.ghost} onClick={() => goTo(5)}>← Back</button>
        </div>
      )}

      {screen === 7 && (
        <div style={T.screen}>
          <div style={T.chip}>Step 7 of 8</div>
          <h1 style={T.h1}>Where savings <em style={T.em}>go.</em></h1>
          <p style={T.sub}>This is the order that makes your money work hardest. Don't skip steps.</p>
          <div style={T.card}>
            {[
              { n: 1, name: "401K employer match", why: "Free money — always capture this first", amt: matchM },
              { n: 2, name: "Emergency fund", why: `Building toward ${fmt(totalExp * 3)} (3 months of expenses)`, amt: emergencyM },
              { n: 3, name: "HSA", why: "Pre-tax in, grows tax-free, withdraws tax-free", amt: hsaMonthly },
              { n: 4, name: "Roth IRA", why: "Tax-free growth. 2026 limit: $7,500/yr", amt: rothM },
              { n: 5, name: "Remaining to savings", why: "Brokerage, HYSA, or additional goals", amt: remainingM },
            ].map((step, i, arr) => (
              <div key={i} style={{ ...T.wfRow, borderBottom: i === arr.length - 1 ? "none" : `1px solid ${border}` }}>
                <div style={T.wfNum}>{step.n}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{step.name}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{step.why}</div>
                </div>
                <div style={{ fontSize: 15, color: accent, fontWeight: 500, flexShrink: 0 }}>{fmt(step.amt)}/mo</div>
              </div>
            ))}
          </div>
          <div style={T.callout}>
            <div style={T.cLbl}>Why this order?</div>
            <p style={T.cTxt}>Each step unlocks something the next can't. Employer match is free money. Emergency fund protects everything else. Tax-advantaged accounts compound faster because you're not paying tax on growth.</p>
          </div>
          <button style={T.btn} onClick={() => goTo(8)}>See your plan →</button>
          <button style={T.ghost} onClick={() => goTo(6)}>← Back</button>
        </div>
      )}

      {screen === 8 && t && (
        <div style={T.screen}>
          <div style={T.chip}>Your plan</div>
          <h1 style={T.h1}>Financial <em style={T.em}>starting line.</em></h1>
          <p style={T.sub}>Based on your numbers. Screenshot this — it's your roadmap.</p>
          <div style={{ ...T.card, padding: "28px 24px", marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: muted, marginBottom: 8 }}>{cityData?.name} · {cityData?.state}</div>
            <div style={{ fontSize: 42, color: accent, fontWeight: 300 }}>{fmt(gross)}</div>
            <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>gross annual salary</div>
          </div>
          <div style={T.statGrid}>
            {[
              { label: "Take-home", val: fmt(t.takehomeM) + "/mo", c: "green" },
              { label: "Rent ceiling", val: fmt(rent) + "/mo", c: "blue" },
              { label: "Monthly savings", val: fmt(savings) + "/mo", c: "green" },
              { label: "Savings rate", val: fmtPct(savingsRate), c: "" },
            ].map((stat, i) => (
              <div key={i} style={T.stat}>
                <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: muted, marginBottom: 6 }}>{stat.label}</div>
                <div style={T.statV(stat.c)}>{stat.val}</div>
              </div>
            ))}
          </div>
          <div style={T.projCard}>
            <div style={{ fontSize: 12, color: "#8aab3e", marginBottom: 6 }}>If you start saving now, in 10 years you'll have approximately</div>
            <div style={{ fontSize: 38, color: accent, fontWeight: 300 }}>{fmt(fv)}</div>
            <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>Assumes 7% annual return, compounded monthly</div>
          </div>
          <div style={T.secLabel}>Health checks</div>
          <div style={T.card}>
            {[
              { label: "Rent < 40% of take-home", pass: t.takehomeM > 0 && rent / t.takehomeM < 0.4 },
              { label: "Savings rate > 20%", pass: savingsRate > 20 },
              { label: "Savings rate > 30%", pass: savingsRate > 30 },
              { label: "401K employer match captured", pass: k401Monthly > 0 },
            ].map((c, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i === arr.length - 1 ? "none" : `1px solid ${border}`, fontSize: 14 }}>
                <div style={T.dot(c.pass)} />
                <span>{c.label}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: muted, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>All figures are estimates. Not financial advice.</p>
          <button style={T.ghost} onClick={() => { setScreen(1); setCity(null); setSalary(""); setExpenses({}); setSlider(50); }}>Start over</button>
        </div>
      )}
    </div>
  );
}

