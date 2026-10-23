# Gmail Recruiter Agent

A Google Apps Script agent that reads recruiter emails in Gmail,
drafts a reply using the Gemini API, and sends a daily digest.

## Why drafts, not auto-send

Replies contain salary and notice-period details. A hallucinated
number sent to a recruiter cannot be taken back, so the agent
creates drafts and the user reviews before sending.

## How it works

1. A Gmail filter labels incoming recruiter mail as `JobMail`
2. A time-driven trigger runs every 15 minutes
3. The email body is sent to Gemini with a fixed facts object
4. Gemini decides which fields the recruiter asked for and formats a reply
5. The reply is saved as a Gmail draft
6. A daily digest at 8 PM lists every draft with a preview

## Design notes

- Personal data lives in a `ME` constant, not in the prompt's free
  text. The model only chooses which fields to include — it cannot
  invent a salary figure.
- The prompt instructs the model to write `__` for anything not in
  the facts, rather than guessing.
- The API key is stored in Script Properties, never in source.

## Setup

1. Get a Gemini API key from aistudio.google.com
2. Create a Gmail filter applying the label `JobMail`
3. Create a new project at script.google.com
4. Add `GEMINI_KEY` under Project Settings → Script Properties
5. Paste `Code.gs` and fill in the `ME` object
6. Run `setupTriggers` once

## Stack

Google Apps Script, Gmail API, Gemini API
