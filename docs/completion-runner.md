# Automated completion workflow runner

The local evaluation runner removes conversational report copying and deadline monitoring from completion trials. It executes a trusted frozen schedule with at most two concurrent workflows and sequential implementation, validation and integration stages. It is evaluation infrastructure, not a production task router or an activation change. Execution is validated on Linux; other hosts need their own process, socket and sandbox preflight.

Run deterministic checks without models or network:

```sh
node scripts/forgeflow/test-completion-runner.js
```

The standard test discovery includes this wrapper. It runs nine Python checks on Linux and explicitly reports unperformed checks on other hosts. Python 3 is required on Linux.

Run an explicitly authorized, privately prepared schedule:

```sh
python3 scripts/forgeflow/run-completion-workflows.py /path/to/schedule.json
```

The schedule contains exact command arguments, source and instruction hashes, distinct workspace/output paths, stage packets, a correction packet, acceptance command and time/word budgets. It is trusted executable configuration and stays local. The runner never constructs shell commands from those values. All paths and source snapshots must be prepared before launch. Model execution uses the existing CLI authentication; credentials are never placed in the schedule.

Each model process writes its final report directly to an artifact. The runner verifies completion events, word counts and stage write boundaries, then copies the exact report to the next stage's context. Correction resumes each recorded context ID, in the same order, using exact acceptance failures. Final acceptance runs the external oracle and existing/new tests. A first-pass success has no correction duration; a failed correction is censored. Output directories and the launch marker cannot be reused to silently replace attempts.

The runner enforces monotonic deadlines outside the model conversation. Every command has its own process group; timeout and normal exit both terminate remaining descendants in that group. Timings include preparation, model execution, tools, handoffs and verification. JSON events retain exposed usage and tool counts; those are CLI observations rather than guarantees of complete backend accounting.

Use short absolute temporary paths and explicit permission for disposable local socket fixtures. Workspace sandboxing remains enabled; persistent services, live native prompts and external calls are outside the trial task. The same settings must apply to both arms. A complete model smoke workflow must pass before freezing a comparison. Source hashes, Git state and report checks supplement the sandbox; they do not prove exhaustive read isolation or absence of transient edits.

The [original completion pilot](completion-pilot-results.md) remains unchanged. Any automated comparison has its own freeze and results and must retain failures, timeouts and unlaunched slots. Different dispatch environments prevent treating before/after timing as a pure causal measurement of runner improvement.

CLI report capture and explicit session resumption follow [OpenAI's non-interactive execution documentation](https://learn.chatgpt.com/docs/non-interactive-mode), checked against the installed CLI. The configuration must be verified again on another host; unsupported options are a preflight failure rather than permission to bypass the sandbox.
