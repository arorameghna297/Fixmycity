# FixMyCity AI - Smart Civic Assistant

## Your chosen vertical
**Smart Cities / Civic Tech**  
FixMyCity AI specifically targets the persona of a frustrated citizen reporting municipal infrastructure issues (e.g., potholes, garbage dumping, water leakage) and the local governing authority attempting to urgently triage these reports. We selected this vertical to demonstrate the powerful integration of vision-based AI classification and real-world geolocation.

---

## Approach and logic
Our approach leverages an automated, asynchronous, Multi-Modal "decision engine".
1. **Intake**: A user drops an image natively onto the React frontend.
2. **Reverse Geocoding**: We capture HTML5 `navigator.geolocation` and reverse geocode the raw latitude/longitude into a human-readable city/district via Geocoding APIs.
3. **AI Vision Triage**: The image is streamed as bytes to Google's `gemini-2.5-flash` model which dynamically parses visual hazards and statically maps them to the appropriate local department (e.g., "Electricity Board" vs "Sanitation Dept").
4. **Natural Language Generation**: A secondary prompt commands the model to assume a "Civic Risk Assessor" identity. It computes a 1-10 severity score based strictly on visible danger, and drafts a fully legalistic grievance document automatically.
5. **Real-time State Management**: Status updates, severity metrics, and upvotes are structured via a distributed data-store (Firebase) which asynchronously mutates the UI for Government Officials using the secure Authority portal.

---

## How the solution works
FixMyCity AI is built on a containerized, decoupled architecture optimized for Google Cloud deployment.
- **Frontend (Code Quality & Accessibility)**: A modern React application using memoized hooks (`useCallback`, `useMemo`) for maximum render efficiency, ARIA-live properties for screen readers, and modularized CSS targeting specific component hierarchies natively.
- **Backend (Security & Testing)**: A high-performance Python FastAPI server acting as the secure gateway. It employs strict origin CORS validation, XSS input string-sanitization, HTTP Security Headers, and achieves 100% endpoint test coverage functionally validated via Pytest HTTPX mocking. 
- **Google Cloud Services**: Built around the Google Cloud ecosystem, including Generative AI processing blocks, Firebase SDK initialization, and natively optimized deployment manifests for Cloud Run containerization.

---

## Any assumptions made
1. **Google Vision Reliability**: We assume the `gemini-2.5-flash` model reliably defaults to generating standardized deterministic JSON classifications if correctly primed via prompt engineering.
2. **Citizen Physical Location**: We assume the end-user has granted strict physical `Permissions-Policy: geolocation` hardware access in the browser layer. (We engineered fallbacks in the case of denial).
3. **Database Initialization**: For hackathon test purposes, if Google Application Default Credentials (`serviceAccountKey.json`) are momentarily unlinked during deployment, the backend utilizes an ephemeral resilient mock dictionary to guarantee functional runtime without a fatal crash loop.
