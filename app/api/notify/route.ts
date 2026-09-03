import { NextResponse } from 'next/server'

interface NotifyBody {
  userId: string
  message: string
}

export async function POST(request: Request) {
  try {
    const { userId, message } = (await request.json()) as NotifyBody

    // ------------------------------------------------------------------
    // INTERNAL LOGGING: This proves the trigger fired successfully!
    // ------------------------------------------------------------------
    console.log(`[NOTIFY TRIGGER FIRED] user ${userId}: ${message}`)

    // ------------------------------------------------------------------
    // FUTURE RESEND.COM / TWILIO INTEGRATION
    // Once you sign up, look up the user's contact info (profiles.email /
    // profiles.phone via userId) and send `message` through it. Example
    // for Resend:
    // ------------------------------------------------------------------
    /*
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Grade & Slab Updates <updates@gradeandslab.co.za>',
        to: [customerEmail],
        subject: 'Grade & Slab — submission update',
        html: `<p>${message}</p>`,
      })
    });
    */

    return NextResponse.json({ success: true, message: 'Notify trigger fired' })
  } catch (error) {
    console.error('Error processing notify trigger:', error)
    return NextResponse.json({ error: 'Failed to process notify trigger' }, { status: 500 })
  }
}