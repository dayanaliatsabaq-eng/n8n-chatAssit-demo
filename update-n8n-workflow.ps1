# n8n Workflow Auto-Updater for Suggestion Chips
# ─────────────────────────────────────────────────────────────────
# 1. Go to https://n8n.srv1328776.hstgr.cloud
# 2. Settings → n8n API → Create an API key → copy it
# 3. Paste it below and run this script in PowerShell
# ─────────────────────────────────────────────────────────────────

$N8N_API_KEY = "PASTE_YOUR_API_KEY_HERE"
$N8N_BASE    = "https://n8n.srv1328776.hstgr.cloud"
$WORKFLOW_ID = "K-XRL55PmPFgre_Ue1bR_"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

# ── Fetch current workflow ────────────────────────────────────────
Write-Host "Fetching workflow..." -ForegroundColor Cyan
$wf = Invoke-RestMethod -Uri "$N8N_BASE/api/v1/workflows/$WORKFLOW_ID" `
        -Method GET -Headers $headers

# ── New node codes ────────────────────────────────────────────────

$parseSupervisorCode = @'
// ═══ PARSE SUPERVISOR OUTPUT ════════════════════════════════════
const item = $input.first().json;

let supervisorRaw = item.output || item.text || item.response || '';
if (!supervisorRaw && Array.isArray(item.steps)) {
  for (let i = item.steps.length - 1; i >= 0; i--) {
    const s = item.steps[i];
    const c = s?.action?.returnValues?.output || s?.action?.log;
    if (c && typeof c === 'string' && c.trim()) { supervisorRaw = c.trim(); break; }
  }
}
supervisorRaw = (supervisorRaw || '').trim();

let finalResponse = null;
let wasRewritten = false;

if (supervisorRaw.startsWith('APPROVED:')) {
  finalResponse = supervisorRaw.replace(/^APPROVED:\s*/i, '').trim();
} else if (supervisorRaw.startsWith('REWRITTEN:')) {
  finalResponse = supervisorRaw.replace(/^REWRITTEN:\s*/i, '').trim();
  wasRewritten = true;
} else {
  finalResponse = supervisorRaw.length > 5 ? supervisorRaw : null;
}
if (!finalResponse || finalResponse.length < 2) {
  finalResponse = "We'd love to help — want to jump on a quick call with our team?";
}

const leakPatterns = [
  /\[Calling [^\]]*\]/gi, /\[Using [^\]]*\]/gi, /\[Tool[^\]]*\]/gi,
  /\[Querying[^\]]*\]/gi, /\[Searching[^\]]*\]/gi
];
for (const p of leakPatterns) finalResponse = finalResponse.replace(p, '').trim();
finalResponse = finalResponse.replace(/  +/g, ' ').trim();

if (finalResponse.length > 600) {
  const sentences = [];
  const re = /[^.!?]*[.!?]+(?:\s|$)/g;
  let m;
  while ((m = re.exec(finalResponse)) !== null) {
    sentences.push(m[0].trim());
    if (sentences.length === 2) break;
  }
  finalResponse = sentences.length > 0 ? sentences.join(' ').trim() : finalResponse.substring(0, 300).trim();
}

// ── Context-aware suggestions ─────────────────────────────────────
let classification = 'FAQ';
try { classification = $('Collect Sub-Agent Output').first().json.classification || $('Message Classifier').first().json.classification || 'FAQ'; } catch(e) {}

const suggestionsByType = {
  FAQ:      ["Tell me about your services", "View portfolio", "How does it work?", "Get in touch"],
  LEAD:     ["Schedule a call", "Get a free quote", "See pricing", "View our work"],
  BOOKING:  ["Confirm my booking", "Change the time", "Learn about the process", "Contact support"],
  OFFTOPIC: ["Our services", "Portfolio", "Get a quote", "Book a call"]
};
const suggestions = suggestionsByType[classification] || suggestionsByType.FAQ;

let sessionId = null;
let cacheKey = null;
try { sessionId = $('Collect Sub-Agent Output').first().json.sessionId; } catch(e) {}
try { cacheKey = $('Collect Sub-Agent Output').first().json.cacheKey; } catch(e) {}

return {
  json: { response: finalResponse, suggestions, sessionId, cacheKey, wasRewritten,
          timestamp: new Date().toISOString(), servedFromCache: false }
};
'@

$outputSanitizerCode = @'
// ═══ OUTPUT SANITIZER ═══════════════════════════════════════════
const item = $input.first().json;
let response = item.response || '';

const leakPatterns = [
  /\[Calling Pinecone[^\]]*\]/gi, /\[Calling [^\]]*\]/gi, /\[Using [^\]]*\]/gi,
  /\[Tool[^\]]*\]/gi,
  /Let me (check|look that up|search|query|find)[^.!?]*/gi,
  /I('ll| will) (check|look|search|query|find)[^.!?]*/gi,
  /Searching (Pinecone|the database|our knowledge base)[^.!?]*/gi,
  /Querying[^.!?]*/gi
];
for (const pattern of leakPatterns) response = response.replace(pattern, '').trim();
response = response.replace(/  +/g, ' ').trim();
if (response.length > 600) {
  const sentences = response.match(/[^.!?]+[.!?]+/g) || [response];
  response = sentences.slice(0, 2).join(' ').trim();
}
return { json: { ...item, response, suggestions: item.suggestions || [] } };
'@

$serveFromCacheCode = @'
// ═══ SERVE FROM CACHE ════════════════════════════════════════════
const item = $input.first().json;
return { json: { response: item.cachedResponse, suggestions: [], sessionId: item.sessionId, timestamp: new Date().toISOString(), servedFromCache: true } };
'@

$serveFromCache1Code = @'
// ═══ SERVE FROM CACHE 1 ══════════════════════════════════════════
const item = $input.first().json;
return { json: { response: item.cachedResponse, suggestions: [], sessionId: item.sessionId, timestamp: new Date().toISOString(), servedFromCache: true, agent: 'cache' } };
'@

# ── Patch nodes in the workflow object ───────────────────────────
$patchMap = @{
    "Parse Supervisor Output" = $parseSupervisorCode
    "Output Sanitizer"        = $outputSanitizerCode
    "Serve From Cache"        = $serveFromCacheCode
    "Serve From Cache1"       = $serveFromCache1Code
}

foreach ($node in $wf.nodes) {
    if ($patchMap.ContainsKey($node.name)) {
        Write-Host "  Patching: $($node.name)" -ForegroundColor Yellow
        $node.parameters.jsCode = $patchMap[$node.name]
    }
}

# ── PUT the updated workflow back ─────────────────────────────────
Write-Host "`nSaving workflow..." -ForegroundColor Cyan
$body = $wf | ConvertTo-Json -Depth 20
$result = Invoke-RestMethod -Uri "$N8N_BASE/api/v1/workflows/$WORKFLOW_ID" `
            -Method PUT -Headers $headers -Body $body
Write-Host "Done! Workflow saved. ID: $($result.id)" -ForegroundColor Green
