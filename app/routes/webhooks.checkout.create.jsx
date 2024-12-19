import { json } from "@remix-run/node";

export async function action({ request }) {
  const shop = request.headers.get("x-shopify-shop-domain");
  const body = await request.json();

  console.log('🛍 Full Request Details:', {
    method: request.method,
    headers: Object.fromEntries([...request.headers]),
    shop,
  });

  console.log('📦 Complete Webhook Body:', body);

  try {
    const response = await fetch('https://us-central1-payment-m.cloudfunctions.net/handleCheckoutCreate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': shop,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        shop: shop,
        cartToken: body.cart_token || body.token,
        checkoutToken: body.id || body.token,
        raw: body
      })
    });

    const responseText = await response.text();
    console.log('🔄 Function Response:', {
      status: response.status,
      text: responseText
    });

    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}: ${responseText}`);
    }

    return json({ success: true });
  } catch (error) {
    console.error('❌ Detailed Error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    return json({ error: error.message }, { status: 500 });
  }
} 