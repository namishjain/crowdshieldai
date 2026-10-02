# Run and deploy CrowdShield

## Run the packaged demo on Windows

1. Extract `CrowdShield_AI_Hackathon_MVP.zip` to a normal folder.
2. Install Python 3.14 x64 and Node.js 24 x64. PostgreSQL 18 is optional unless you want database history.
3. In VS Code, open the extracted `CrowdShield_AI_Hackathon_MVP` folder. Open **Terminal → New Terminal** and make sure the terminal profile is **PowerShell**.
4. If enabling PostgreSQL history, start the PostgreSQL Windows service, open pgAdmin, create an empty database named `crowdshield`, then copy the project root `.env.example` to `.env`. Put your own local PostgreSQL password in `CROWDSHIELD_DATABASE_URL`; never share the `.env` file.
5. In the PowerShell terminal, run setup once:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\scripts\setup_demo.ps1
   ```

   Setup installs Python and frontend packages, builds the interface, and verifies the bundled 15-second clips/model. If the clips or model are missing, the downloader keeps total video downloads below 2 GB.

6. Start the demo:

   ```powershell
   .\start_demo.ps1
   ```

7. Open [http://127.0.0.1:8000/app](http://127.0.0.1:8000/app). The same local service serves both the dashboard and the API.
8. Stop it later with:

   ```powershell
   .\stop_demo.ps1
   ```

## Develop the frontend in VS Code

Run FastAPI in one PowerShell terminal:

```powershell
& .\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Run the new React/Vite interface in a second terminal:

```powershell
Set-Location frontend
npm run dev
```

Open [http://127.0.0.1:3000/app](http://127.0.0.1:3000/app). Vite proxies API, WebSocket and video requests to FastAPI on port 8000. Stop each development server with Ctrl+C.

## Host it for remote access

This ZIP is prepared for a local demo. A public hosted URL has not been created because no hosting account or target server was supplied. The frontend is built to static files in `frontend/dist`; FastAPI serves those files together with the API on port 8000.

For a private demo server, deploy the project to a Windows or Linux host with Python 3.14, the bundled camera/model assets, and PostgreSQL if history is needed. Install `requirements.txt`, run `npm ci` and `npm run build` in `frontend`, configure `CROWDSHIELD_DATABASE_URL` on the server, then launch `uvicorn backend.app.main:app` behind an HTTPS reverse proxy. Keep PostgreSQL off the public internet and restrict access to the server.

The prototype currently has no sign-in or role permissions. Before exposing it publicly, add authentication/authorization for state-changing endpoints and review data retention, HTTPS, firewall, and host resource settings. All gate operations are software-graph updates; there is no physical control integration.
