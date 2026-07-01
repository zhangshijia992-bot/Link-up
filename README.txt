Link-Up AI Matching Desktop Prototype

Run the project
1. Open this folder in VS Code.
2. In the terminal, run:
   python run_linkup_ai_matching.py
3. Open:
   http://127.0.0.1:4173/

Alternative:
Double-click "Start Link-up AI matching.bat".

Main files
- Link-up AI matching.py: Python backend server, Gemini API connector, fallback matching engine, CSV storage.
- Link-up AI matching.html: Desktop user interface.
- linkup-ai-matching.css: Desktop UI styling.
- linkup-ai-matching.js: Frontend routing and interactions.
- users.csv: Private backend candidate library with around 50 user profiles.

AI API setup
The app supports Gemini API through the backend. Do not put the API key in HTML or JavaScript.

Recommended setup:
1. Run the app.
2. Open AI Matching.
3. Click "Configure Gemini Key".
4. Paste the Gemini API key and save.

The key will be saved locally as:
gemini_api_key.txt

This is more reliable than setx because the Python server can read the key directly from the project folder every time it starts.

PowerShell example:
setx GEMINI_API_KEY "YOUR_GEMINI_API_KEY"

Then close and reopen the terminal, and run:
python run_linkup_ai_matching.py

If GEMINI_API_KEY is not configured, the app still works using the local fallback matching engine. The UI will show "Fallback AI". This is intentional so the prototype can still be demonstrated without network or API quota problems.

Implemented functions
- Dashboard with four main functions
- AI Matching with three modes
- Manual collaborator/team search
- Team creation and recruitment preview
- Competition detail with requirements, rewards and existing teams
- Messages with locked/unlocked collaboration chats
- Collaboration lifecycle status
- Profile and portfolio preview

Why CSV is used
CSV is used only as backend prototype storage. Normal users do not see the CSV file in the interface. In the final system, it can be replaced by a cloud database such as Firebase, MongoDB or MySQL.
