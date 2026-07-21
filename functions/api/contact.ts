// Cloudflare Pages Function: POST /api/contact
// 掲載希望事業者向けお問い合わせを Discord Webhook に通知する。
// Webhook URL は環境変数 DISCORD_WEBHOOK_URL から読む（リポには格納しない）。

interface Env {
  DISCORD_WEBHOOK_URL?: string;
}

const trim = (v: unknown, max = 1900) => String(v ?? '').slice(0, max);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: '不正なリクエストです。' }, 400);
  }

  // honeypot: bot が hidden 欄を埋めたら成功を装って破棄
  if (trim(body.website)) {
    return json({ ok: true });
  }

  const email = trim(body.email, 200);
  const message = trim(body.message);
  if (!isEmail(email)) {
    return json({ ok: false, error: 'メールアドレスの形式をご確認ください。' }, 400);
  }
  if (!message) {
    return json({ ok: false, error: 'お問い合わせ内容をご入力ください。' }, 400);
  }

  if (!env.DISCORD_WEBHOOK_URL) {
    return json({ ok: false, error: 'サーバー設定が未完了です。時間をおいて再度お試しください。' }, 500);
  }

  const content = [
    '**📩 掲載・提携のお問い合わせ（ゲーム買取びより）**',
    `**種別**: ${trim(body.type, 100) || '(未選択)'}`,
    `**サービス名・店舗名**: ${trim(body.service, 200) || '(未記入)'}`,
    `**運営会社**: ${trim(body.company, 200) || '(未記入)'}`,
    `**ご担当者**: ${trim(body.person, 200) || '(未記入)'}`,
    `**メール**: ${email}`,
    `**電話**: ${trim(body.tel, 100) || '(未記入)'}`,
    '**内容**:',
    message,
  ].join('\n');

  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.slice(0, 1990) }),
  });

  if (!res.ok) {
    return json({ ok: false, error: '送信に失敗しました。時間をおいて再度お試しください。' }, 502);
  }

  return json({ ok: true });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
