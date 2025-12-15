# Architecture Overview

## High-Level System Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                     │
│                         (React + Lovable Platform)                              │
├────────────┬────────────┬────────────┬────────────┬────────────┬───────────────┤
│  Dashboard │ Study Plan │ AI Counsel │  Concept   │   Video    │  Focus Zone   │
│            │  Generator │    Chat    │  Explainer │  Library   │               │
└─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴───────────────┘
      │            │            │            │            │
      └────────────┴────────────┼────────────┴────────────┘
                                │
                     ┌──────────▼──────────┐
                     │    AGENT CORE       │
                     │  (Edge Functions)   │
                     │                     │
                     │  ┌───────────────┐  │
                     │  │   PLANNER     │  │
                     │  │ - Task decomp │  │
                     │  │ - Context mgmt│  │
                     │  └───────────────┘  │
                     │                     │
                     │  ┌───────────────┐  │
                     │  │   EXECUTOR    │  │
                     │  │ - Prompt eng. │  │
                     │  │ - JSON parsing│  │
                     │  │ - Retry logic │  │
                     │  └───────────────┘  │
                     │                     │
                     │  ┌───────────────┐  │
                     │  │    MEMORY     │  │
                     │  │ - Chat history│  │
                     │  │ - User prefs  │  │
                     │  │ - Video cache │  │
                     │  └───────────────┘  │
                     └──────────┬──────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼───────┐     ┌─────────▼────────┐    ┌────────▼────────┐
│  Google       │     │   ElevenLabs     │    │   Database      │
│  Gemini API   │     │   TTS API        │    │  (PostgreSQL)   │
│               │     │                  │    │                 │
│ gemini-2.5-   │     │ Multilingual v2  │    │ - User profiles │
│ flash         │     │ Voice synthesis  │    │ - Chat history  │
│               │     │                  │    │ - Video data    │
└───────────────┘     └──────────────────┘    └─────────────────┘
```

---

## Components

### 1. User Interface

**Technology:** React 18 + TypeScript + Tailwind CSS, built with Lovable

**Key Screens:**
| Screen | Purpose |
|--------|---------|
| **Dashboard** | Central hub showing study progress, tasks, and quick actions |
| **Study Plan Generator** | Create personalized, AI-generated study schedules |
| **AI Counselor** | Conversational chat for emotional support and study guidance |
| **Concept Explainer** | Get explanations at varying difficulty levels (ELI5 → Advanced) |
| **Video Library** | YouTube video analysis with AI-generated summaries |
| **Focus Zone** | Pomodoro timer and focus tools |

**UI Features:**
- Multi-language support (EN, ES, FR, DE, ZH, HI, AR)
- Audio controls (play/pause/stop/volume/mute)
- Responsive design with mobile support
- Dark/light mode theming

---

### 2. Agent Core

The Agent Core consists of serverless Edge Functions that handle all AI interactions:

#### **Planner Module**

The planner breaks down user requests into structured prompts:

```
User Request → Task Decomposition → Context Assembly → Prompt Construction
```

**Examples:**
- Study Plan: Calculates days/weeks until exam, structures weekly plans
- Concept Explainer: Maps difficulty levels to appropriate language complexity
- AI Counselor: Maintains conversation history for contextual responses

#### **Executor Module**

Handles LLM communication with robust error handling:

```typescript
// Retry logic with exponential backoff
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const response = await fetch(GEMINI_API_ENDPOINT, {...});
    // Handle response
  } catch (error) {
    await delay(1000 * attempt);  // Exponential backoff
  }
}
```

**Execution Features:**
- 3-retry mechanism with exponential backoff
- Rate limit handling (429 responses)
- JSON response parsing with markdown cleanup
- Structured output validation

#### **Memory Module**

| Storage Type | Purpose |
|-------------|---------|
| **Conversation History** | Chat messages for AI Counselor context |
| **User Preferences** | Language, difficulty settings, study goals |
| **Video Cache** | Analyzed video data (summaries, concepts, timestamps) |
| **Local Storage** | Session state, tasks, timer preferences |

---

### 3. Tools / APIs

#### **Google Gemini API** (Primary AI Model)

| Function | Model | Purpose |
|----------|-------|---------|
| `ai-counselor` | gemini-2.5-flash | Conversational study support |
| `explain-concept` | gemini-2.5-flash | Multi-level concept explanations |
| `generate-study-plan` | gemini-2.5-flash | Personalized study schedules |
| `analyze-video` | gemini-2.5-flash | Educational video analysis |

**Prompt Engineering Patterns:**
- System prompts with role definitions and language instructions
- Structured JSON output schemas for consistent parsing
- Difficulty-adaptive response generation

#### **ElevenLabs API** (Text-to-Speech)

| Feature | Configuration |
|---------|---------------|
| Model | `eleven_multilingual_v2` |
| Voice | Sarah (EXAVITQu4vr4xnSDxMaL) |
| Output | MP3 @ 44100Hz, 128kbps |
| Voice Settings | Stability: 0.5, Similarity: 0.75, Style: 0.3 |

#### **Database (PostgreSQL)**

- User profiles and authentication
- Chat message persistence
- Video analysis caching
- Study plan storage

---

### 4. Observability

#### **Logging Strategy**

Every Edge Function implements comprehensive logging:

```typescript
// Entry logging
console.log('Explaining concept:', concept, 'at difficulty:', difficulty);

// Success logging  
console.log('Concept explained successfully');

// Error logging with context
console.error("Lovable AI error:", response.status, errorText);
console.error(`Attempt ${attempt} failed:`, lastError.message);
```

#### **Error Handling / Retries**

| Error Type | Status Code | Handling |
|------------|-------------|----------|
| Rate Limit | 429 | Wait 2s × attempt, retry up to 3× |
| Payment Required | 402 | Return user-friendly message |
| API Error | 500 | Log full error, return generic message |
| Parse Error | - | Log raw response, throw specific error |

#### **Retry Configuration**

```
┌─────────────┐   Fail    ┌─────────────┐   Fail    ┌─────────────┐
│  Attempt 1  │ ───────▶  │  Attempt 2  │ ───────▶  │  Attempt 3  │
│             │   1s      │             │   2s      │             │
└─────────────┘   wait    └─────────────┘   wait    └─────────────┘
       │                         │                         │
       │ Success                 │ Success                 │ Success/Fail
       ▼                         ▼                         ▼
   Response                  Response              Final Response/Error
```

#### **Request/Response Flow**

```
Client Request
      │
      ▼
┌─────────────────┐
│ CORS Preflight  │ ──▶ OPTIONS → Return headers
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse Request  │ ──▶ Validate required fields
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check API Keys  │ ──▶ Throw if missing
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Prompts   │ ──▶ System + User prompts with language
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Call Gemini API │ ──▶ With retry logic
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse Response  │ ──▶ JSON extraction + validation
└────────┬────────┘
         │
         ▼
   Return Result
```

---

## Summary

This architecture provides a scalable, resilient AI-powered educational assistant built with:

- **Frontend**: Modern React UI built with Lovable
- **AI Engine**: Google Gemini API for intelligent responses
- **Voice**: ElevenLabs for natural text-to-speech
- **Observability**: Comprehensive logging and error handling with automatic retries
