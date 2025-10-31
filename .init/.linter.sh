#!/bin/bash
cd /home/kavia/workspace/code-generation/real-time-analytics-dashboard-182952-182961/express_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

