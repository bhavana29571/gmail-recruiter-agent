/**
 * Gmail Recruiter Agent
 * Drafts replies to recruiter emails using the Gemini API.
 * Creates drafts only — never sends automatically.
 */

// ========== CONFIGURE BEFORE RUNNING ==========
const ME = {
  name: "Your Name",
  phone: "YOUR_PHONE",
  email: "you@example.com",
  totalExp: "X years",
  currentOrg: "Your Company",
  designation: "Your Title",
  currentCTC: "X LPA",
  expectedCTC: "Y LPA",
  noticePeriod: "Immediate joiner",
  currentLocation: "Your City",
  preferredLocation: "Open to any location",
  skills: "Your core skills, comma separated",
  education: "Your education"
};

// Optional: Google Drive file ID of your CV, to attach to drafts
const RESUME_FILE_ID = "";
// ==============================================

/**
 * Finds unread mail under the JobMail label and drafts a reply for each.
 * Runs every 15 minutes via a time-driven trigger.
 */
function processJobMail() {
  const threads = GmailApp.search('label:JobMail is:unread newer_than:2d', 0, 10);
  Logger.log('Found ' + threads.length + ' thread(s)');

  threads.forEach(thread => {
    try {
      const msgs = thread.getMessages();
      const msg  = msgs[msgs.length - 1];

      // Skip threads that already have a draft waiting
      if (msgs.some(m => m.isDraft())) return;

      const reply = askGemini(msg.getPlainBody().slice(0, 4000));

      thread.createDraftReply(reply, attachOpts());

      logIt(msg.getFrom(), msg.getSubject(), "DRAFT READY");
      thread.markRead();
    } catch (e) {
      Logger.log('ERROR: ' + e);
      logIt("ERROR", e.toString(), "FAILED");
      GmailApp.sendEmail(ME.email, 'Job bot failed',
        'Error: ' + e + '\n\nCheck script.google.com');
    }
  });
}

function attachOpts() {
  if (!RESUME_FILE_ID) return {};
  return { attachments: [DriveApp.getFileById(RESUME_FILE_ID).getBlob()] };
}

/**
 * Sends the recruiter's email to Gemini along with a fixed facts object.
 * The model chooses which fields to include and how to phrase the reply,
 * but cannot invent values — anything missing comes back as "__".
 */
function askGemini(emailBody) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            + 'gemini-3.8-flash:generateContent?key=' + key;

  const prompt = `Draft a reply to this recruiter for the candidate below.

RULES:
- Use ONLY the facts given. Never invent a number, year, or skill.
- If the recruiter asks for something not in the facts, write "__" so the
  candidate fills it in manually. Do not guess.
- If asked about a skill the candidate does not have, say so honestly.
- Keep it short and professional. Bullet the requested details.
- Sign off with the name and phone. Plain text, no markdown.

FACTS: ${JSON.stringify(ME)}

RECRUITER EMAIL:
${emailBody}`;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    muteHttpExceptions: true
  });

  return JSON.parse(res.getContentText()).candidates[0].content.parts[0].text;
}

/** Appends an entry to the running log held in Script Properties. */
function logIt(from, subj, action) {
  const p = PropertiesService.getScriptProperties();
  const log = JSON.parse(p.getProperty('LOG') || '[]');
  log.push({ t: new Date().toLocaleString('en-IN'), from, subj, action });
  p.setProperty('LOG', JSON.stringify(log));
}

/**
 * Emails a daily summary of every draft created since the last digest,
 * each with a short preview, then clears the log.
 */
function sendDigest() {
  const p = PropertiesService.getScriptProperties();
  const log = JSON.parse(p.getProperty('LOG') || '[]');
  if (!log.length) return;

  const drafts = GmailApp.getDrafts();
  let html = `<h2>Job drafts ready — ${log.length}</h2>`;

  log.forEach(r => {
    const clean = String(r.subj).replace(/^Re:\s*/i, '');
    const d = drafts.find(x => x.getMessage().getSubject().indexOf(clean) > -1);
    const preview = d ? d.getMessage().getPlainBody().slice(0, 400) : '(draft not found)';

    html += `<div style="border:1px solid #ddd;padding:12px;margin:10px 0">
               <b>${r.subj}</b><br>
               <span style="color:#666">${r.from}</span><br>
               <small>${r.t}</small>
               <pre style="background:#f6f6f6;padding:8px;white-space:pre-wrap;font-size:12px">${preview}</pre>
             </div>`;
  });

  html += `<p><a href="https://mail.google.com/mail/u/0/#drafts">Open Drafts to review and send</a></p>`;

  GmailApp.sendEmail(ME.email, `Job drafts ready (${log.length})`, '', { htmlBody: html });
  p.deleteProperty('LOG');
}

/** Run once to install the time-driven triggers. */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('processJobMail').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('sendDigest').timeBased().atHour(20).everyDays(1)
    .inTimezone('Asia/Kolkata').create();
}

/** Diagnostic: confirms the API key works and the model is reachable. */
function debugGemini() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  Logger.log('Key present: ' + (key ? 'YES' : 'NO'));

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            + 'gemini-3.8-flash:generateContent?key=' + key;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: [{ text: 'Say hello' }] }] }),
    muteHttpExceptions: true
  });

  Logger.log('HTTP code: ' + res.getResponseCode());
  Logger.log('Response: ' + res.getContentText().slice(0, 800));
}