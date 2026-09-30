# Example run: Shelfwise (reading list app)

Produced by one command on Sep 30, 2026:

    ./build-app "A personal reading list app: save books with title, author and status (want to read, reading, finished), rate finished books, and see simple reading stats." --budget 60 --parallel 3

Result: 12 features, 36 acceptance criteria, 37/37 Playwright tests passing, lint/typecheck/build green, visual score 8.5/10, code review pass. 1 h 33 min, $25.80.

- `screens/` desktop and mobile screenshots the visual reviewer graded
- `run-output.log` the orchestrator's full console output
- This repository is the complete output, every pipeline stage as a commit. To run it:

      npm install && npm run db:reset && npm run dev
