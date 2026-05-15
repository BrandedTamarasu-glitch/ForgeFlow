# Aegis Fixture - Confirmed Auth Finding

Reviewer: Warden
Finding class: auth/session/permissions

Claim:
`deleteProject(projectId)` accepts a project id from the request body and deletes it without checking whether the current user belongs to that project.

Cited evidence:

```ts
app.post('/projects/delete', async (req, res) => {
  const { projectId } = req.body;
  await db.projects.delete(projectId);
  res.json({ ok: true });
});
```

Expected verifier decision:

```text
Decision: CONFIRMED
Evidence: The request body supplies `projectId`, and the handler calls `db.projects.delete(projectId)` without a user/project access check.
Reasoning: This is a protected resource mutation with attacker-controlled resource id and no authorization boundary.
Required next action: Add an access check tied to the authenticated user before deletion.
```
