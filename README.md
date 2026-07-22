# GridCheck

Offline, deterministic datacenter procurement compliance prototype. It runs entirely in the browser and requires no API key, external model, database, or network service.

## Run locally

```powershell
cd "H:\ACM Hackathon\ETI Hackathon"
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. Stop the server with `Ctrl+C`.

For a production preview:

```powershell
npm.cmd run build
npm.cmd start
```

## Offline copilot prototype

- Upload JSON, CSV, or key-value TXT documents for local field extraction.
- Use **Load prepared PDF demo** for a clearly labeled deterministic PDF fixture.
- Verify extracted fields before the five-rule compliance engine runs.
- Generate executive guidance and RFI emails from local templates.
- Ask rule-based questions grounded in the active report and ten local issue records.
- Inspect cited local source excerpts and export evidence packages.

General PDF, DOCX, and XLSX extraction is intentionally not simulated. Those formats require future local parser libraries or a local model runtime.
