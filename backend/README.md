# Backend

This directory contains the FastAPI server for Policy Pulse.

The server reads the environment variable `DATABUTTON_SERVICE_TYPE` to determine
whether it is running in a deployed service. If the variable is set to `prod`,
`app.env.mode` is `Mode.PROD`; otherwise the server defaults to development
mode.
