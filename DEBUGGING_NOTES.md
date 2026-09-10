# AI Application Debugging Notes

This document captures the major issues, root causes, and fixes discovered while working on the AI application.

## 1. Gemini API migration issues

### Problem
The app was originally wired for OpenAI, but the working integration needed to use Gemini instead.

### Symptoms
- AI extraction was failing or returning empty results
- Gemini requests returned errors such as 404, 500, or 503
- Some older Gemini model names were not valid for the active API key

### Root cause
The code path was still trying to use the wrong API structure and model names.

### Fix
- Switched the document extraction flow to the Gemini `generateContent` API
- Used env-driven configuration for `GEMINI_API_KEY` and `GEMINI_MODEL`
- Added fallback model probing so the app could discover working models
- Hardened JSON parsing to support text and fenced JSON responses

### Interesting errors captured
- `404 Not Found` for unsupported Gemini model names
- `503 Service Unavailable` for overloaded or unavailable model endpoints
- `Failed to parse JSON output from Gemini` when the API returned unstructured text

---

## 2. Port conflict on startup (`EADDRINUSE`)

### Problem
The app could not restart cleanly because port 3002 was already occupied.

### Symptoms
- `npm run dev` failed with `Error: listen EADDRINUSE: address already in use :::3002`
- Nodemon kept restarting and then crashed

### Root cause
A previous Node process was still running and holding the same port.

### Fix
- Stopped the stale Node process
- Re-ran the app after clearing port 3002

### Interesting errors captured
- `Error: listen EADDRINUSE: address already in use :::3002`

---

## 3. Logout `ERR_CONNECTION_REFUSED`

### Problem
When the user tried to log out, the browser showed a connection refused error.

### Root cause
The app server was not running on the expected port, so the request could not reach the backend.

### Fix
- Restarted the app on port 3002
- Confirmed the server was live before testing logout again

### Lesson
If the app is down, frontend actions can appear confusing even when the route itself is correct.

---

## 4. Registration failure caused by schema mismatch

### Problem
New user registration failed even after password validation was relaxed.

### Symptoms
- The app showed `An error occurred during registration`
- The request would not complete successfully

### Root cause
The database `users` table was missing the `name` column, and the live role constraint did not allow the `user` role.

### Fix
- Added the missing `name` column
- Updated the role constraint to include `user`
- Updated inserts in the register route, seed data, and Google auth code to insert the required `name` field

### Interesting errors captured
- `column "name" of relation "users" does not exist`
- `new row for relation "users" violates check constraint "users_role_check"`

---

## 5. Duplicate email registration issue

### Problem
A user could try to register again with an email that was already in the system.

### Root cause
There was no early duplicate-email check in the registration flow.

### Fix
- Added a `/check-email` endpoint
- Added real-time frontend checking on the register page
- Added clearer server-side duplicate-email messaging

### User-facing message now
> This email is already registered. Please sign in instead, or use a different email address.

### Lesson
This saves users time by preventing them from completing the entire form when they already have an account.

---

## 6. Password validation and feedback issues

### Problem
The original registration flow had a password rule that was too strict and confusing.

### Symptoms
- Users saw unclear or misleading validation errors
- The UI described a password rule that was not actually the one the app enforced

### Root cause
The app had a validation function that required uppercase, lowercase, number, and special character, but the actual real-world requirements had drifted.

### Fix
- Simplified the password validation to a clear minimum-length rule
- Updated the register page text to match the actual rule
- Improved mismatch messages

### User-facing messages now
- `Password must be at least 8 characters long`
- `Passwords do not match. Please make sure both password fields are identical.`

---

## 7. Login feedback improvements

### Problem
The login flow did not distinguish between missing account, wrong password, and invalid input.

### Root cause
The app used the same generic error for multiple different login failures.

### Fix
- Added clearer messages for:
  - email not registered
  - incorrect password

### User-facing messages now
- `No account found for this email. Please register first.`
- `Incorrect password. Please try again.`

---

## 8. Role-based upload restriction

### Problem
The business flow required that only users upload documents, while reviewers, managers, finance, and admin act as approvers.

### Root cause
The app originally allowed upload access more broadly than intended.

### Fix
- Restricted upload routes to `hasRole('user')`
- Hid upload buttons in the UI for non-user roles
- Updated new registrations to default to `user`

### Result
- Users can upload
- Approval roles can review and approve without uploading

---

## 9. Interesting lessons from this project

### Lessons learned
1. Always verify the live database schema, not just the local code assumptions.
2. Port conflicts can appear as unrelated frontend errors.
3. API model availability can change by key, so fallback handling is important.
4. Role constraints and business logic should be aligned in both app code and database rules.
5. Clear user feedback matters almost as much as the technical fix.

---

## 10. Recommended next improvements

- Add a dedicated admin dashboard for approvals
- Add better status messages on document approval pages
- Add tests for registration, login, and duplicate-email behavior
- Add logging around approval transitions so it is easier to debug workflow issues later
