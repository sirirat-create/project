// แจ้งเตือนเข้า Slack — ถ้าไม่ตั้ง SLACK_WEBHOOK_URL จะข้ามไปเงียบๆ
export async function notifySlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn('[slack] ส่งไม่สำเร็จ:', res.status, await res.text());
  } catch (err) {
    console.warn('[slack] ส่งไม่สำเร็จ:', err.message);
  }
}
