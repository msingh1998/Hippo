import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    const data = await request.json();
    const { cashbackPercentage } = data;

    // Validate input
    if (typeof cashbackPercentage !== 'number' || cashbackPercentage < 0 || cashbackPercentage > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid cashback percentage' }),
        { status: 400 }
      );
    }

    // Update settings in Firebase
    const response = await fetch(`${process.env.FIREBASE_FUNCTIONS_URL}/updateStoreSettings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shop: session.shop,
        cashbackPercentage
      })
    });

    const result = await response.json();
    return new Response(JSON.stringify(result));

  } catch (error) {
    console.error('Error updating settings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update settings' }),
      { status: 500 }
    );
  }
} 