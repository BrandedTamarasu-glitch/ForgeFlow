document.querySelector('button').addEventListener('click', async () => {
  const status = document.querySelector('[role="status"]');
  try {
    const response = await fetch('/api/availability');
    if (!response.ok) throw new Error('unavailable');
    const body = await response.json();
    if (body.available !== true) throw new Error('unavailable');
    status.textContent = 'Available';
  } catch {
    status.textContent = 'Availability unavailable. Try again.';
  }
});
