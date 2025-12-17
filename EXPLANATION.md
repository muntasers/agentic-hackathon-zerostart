
---

# Technical Explanation

## 1. Agent Workflow

Our StudyBuddy AI agent processes user inputs through a sophisticated multi-step workflow:

### Step 1: Receive User Input
```
User Input → React Frontend → Form Validation → API Request
```
- User interacts via React components (chat interface, forms, video uploads)
- Input validation occurs client-side using TypeScript interfaces
- Requests are routed to appropriate Supabase Edge Functions

### Step 2: Retrieve Relevant Memory
```
Edge Function → PostgreSQL Database → Previous Context
```
- **AI Counselor**: Retrieves full conversation history from message array
- **Study Plan Generator**: Fetches user's skill level, preferences, and previous plans
- **Video Analyzer**: Checks if video was previously analyzed in database
- **Tasks**: Loads user-specific task history from `tasks` table

### Step 3: Plan Sub-Tasks (ReAct Pattern)
```
Input Analysis → Context Building → Prompt Engineering → Response Structuring
```
Each agent module breaks down tasks:
- **Counselor Agent**: Analyzes emotional context → Plans supportive response → Structures advice
- **Study Planner Agent**: Calculates time constraints → Divides topics by difficulty → Creates weekly milestones
- **Concept Explainer Agent**: Assesses difficulty level → Plans explanation structure → Prepares analogies and examples
- **Video Analyzer Agent**: Extracts video metadata → Plans content analysis → Structures educational breakdown

### Step 4: Call Tools/APIs
```
Edge Function → Google Gemini API → Response Processing
                ↓
          ElevenLabs API → Audio Generation
```

### Step 5: Summarize and Return Output
```
Raw API Response → JSON Parsing → Data Transformation → Database Storage → UI Update
```

---

## 2. Key Modules

### AI Counselor Module (`ai-counselor/index.ts`)
```typescript
Purpose: Emotional support and study guidance
Input: { messages: Message[], language: string, userName?: string }
Process:
  1. Build system prompt with personality and language instructions
  2. Append conversation history for context
  3. Call Gemini API with retry logic (3 attempts)
  4. Parse and return supportive response
Output: { success: boolean, response: string }
```

### Study Plan Generator (`generate-study-plan/index.ts`)
```typescript
Purpose: Creates personalized week-by-week study schedules
Input: { subject, topics, examDate, dailyHours, skillLevel, language, syllabusContent? }
Process:
  1. Calculate days/weeks until exam
  2. Build structured prompt with JSON schema requirements
  3. Generate comprehensive study plan via Gemini API
  4. Parse JSON response with error recovery
Output: { success: boolean, studyPlan: StructuredPlanObject }
```

### Concept Explainer (`explain-concept/index.ts`)
```typescript
Purpose: Explains concepts at varying difficulty levels (ELI5 to Advanced)
Input: { concept, context?, difficulty, language }
Process:
  1. Select difficulty-appropriate prompt template
  2. Request structured explanation with analogies
  3. Generate key points, examples, and common mistakes
Output: { success: boolean, explanation: ConceptExplanation }
```

### Video Analyzer (`analyze-video/index.ts`)
```typescript
Purpose: Educational analysis of YouTube videos
Input: { youtubeId, title, language }
Process:
  1. Extract video metadata
  2. Generate summary, key concepts, and timestamps
  3. Suggest relevant subjects for categorization
Output: { summary, keyConceptsList, timestamps, suggestedSubjects }
```

### Text-to-Speech Module (`text-to-speech/index.ts`)
```typescript
Purpose: Converts text responses to natural speech
Input: { text, language? }
Process:
  1. Validate text input (max 4096 chars)
  2. Call ElevenLabs API with multilingual v2 model
  3. Encode audio to base64
Output: { success: boolean, audioContent: base64String }
```

### Memory Store (`TaskContext.tsx` + PostgreSQL)
```typescript
Purpose: Persistent task and progress tracking
Operations:
  - addTask(): Insert new task with user binding
  - toggleTask(): Update completion status
  - addTasksFromStudyPlan(): Batch import from generated plans
  - clearCompletedTasks(): Cleanup finished items
Storage: Supabase PostgreSQL with user-scoped queries
```

---

## 3. Tool Integration

### Google Gemini API (Primary AI Engine)
```typescript
// Called with Gemini API key
const response = await fetch('https://ai.gateway.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${GEMINI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
  }),
});
```

### ElevenLabs Text-to-Speech API
```typescript
// Voice synthesis with multilingual support
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.substring(0, 4096),
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  }
);
```

### Supabase Database Operations
```typescript
// Example: Task persistence
const { data, error } = await supabase
  .from('tasks')
  .insert({
    user_id: user.id,
    activity: task.activity,
    type: task.type,
    completed: false,
    source: 'study-plan',
  })
  .select()
  .single();
```

---

## 4. Observability & Testing

### Logging Strategy
Each edge function implements comprehensive logging:

```typescript
// Entry point logging
console.log('AI Counselor responding to conversation with', messages.length, 'messages');

// API call logging
console.log('Generating study plan for:', subject, 'with', weeksUntilExam, 'weeks');

// Success logging
console.log('Study plan generated successfully');

// Error logging with context
console.error('Lovable AI error:', response.status, errorText);
console.error(`Attempt ${attempt} failed:`, lastError.message);
```

### Error Handling Flow
```
API Call → Status Check → Retry Logic → Error Classification → User Feedback
           ↓
    [429] Rate Limit → Exponential Backoff (2s × attempt)
    [402] Payment → Return payment required message
    [4xx/5xx] → Log error → Retry up to 3 times → Throw final error
```

### Tracing Agent Decisions
Judges can trace decisions through:
1. **Console Logs**: Each function logs entry, processing steps, and exit
2. **Error Context**: Full error messages with attempt numbers
3. **Response Structure**: JSON responses include success flags and structured data
4. **Retry Visibility**: Each retry attempt is logged with timing

### Testing Approach
```bash
# Test AI Counselor
curl -X POST ${SUPABASE_URL}/functions/v1/ai-counselor \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"I am stressed about exams"}],"language":"en"}'

# Test Study Plan Generator
curl -X POST ${SUPABASE_URL}/functions/v1/generate-study-plan \
  -H "Content-Type: application/json" \
  -d '{"subject":"Math","topics":"Calculus","examDate":"2025-01-15","dailyHours":2,"skillLevel":"beginner","language":"en"}'
```

---

## 5. Known Limitations

### API Constraints
| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Gemini rate limits | 429 errors during high usage | Exponential backoff with 3 retries |
| ElevenLabs 4096 char limit | Long texts truncated | Text is substring'd to 4096 chars |
| API latency (2-5s) | User waits for responses | Loading states and progress indicators |

### Input Handling Challenges
- **Ambiguous study topics**: AI may generate generic plans for vague inputs
- **Non-educational video titles**: Video analyzer makes assumptions based on title only
- **Multi-language edge cases**: Some languages may have inconsistent formatting

### Performance Bottlenecks
- **Study plan generation**: Complex plans with many weeks take 5-10 seconds
- **Audio generation**: TTS for long responses adds 2-4 seconds delay
- **Concurrent requests**: Multiple users may hit rate limits simultaneously

### Data Limitations
- **Video analysis**: Based on title only, not actual video content
- **No transcript access**: Cannot analyze actual spoken content in videos
- **Session memory**: AI counselor memory limited to current conversation

### Scalability Considerations
- **Database queries**: No pagination for large task lists (>100 items)
- **Audio caching**: TTS results not cached, regenerated each time
- **State management**: React context may need optimization for large datasets

---
