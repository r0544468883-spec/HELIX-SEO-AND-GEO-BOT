import { NextResponse } from 'next/server';
import { handleMessage } from '@/lib/bot/agent';
import { sendTelegram } from '@/lib/bot/channels';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Telegram webhook — inbound control. The user texts the bot; the conversational
// agent runs the right HELIX Rank tool and replies. Return 200 fast.
// Set up: setWebhook to https://<host>/api/telegram with TELEGRAM_BOT_TOKEN.
export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let update: { message?: { chat?: { id?: number }; text?: string } };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const chatId = update.message?.chat?.id;
  const text = update.message?.text;
  if (!token || !chatId || !text) return NextResponse.json({ ok: true });

  try {
    const reply = await handleMessage(text, { lang: 'he' });
    await sendTelegram(token, chatId, reply);
  } catch {
    await sendTelegram(token, chatId, 'קרתה תקלה, נסה שוב 🙏');
  }
  return NextResponse.json({ ok: true });
}
